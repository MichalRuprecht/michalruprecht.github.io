#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "pathname"
require "set"
require "yaml"

ROOT = Pathname.new(__dir__).join("..").expand_path
CLIPS = ROOT.join("pages", "clips")
REQUIRED_FIELDS = %w[layout title clip clip_id publisher date_display byline publisher_url].freeze
COMPANION_FIELDS = {
  "video_element" => "video_clip_number",
  "podcast_element" => "podcast_clip_number",
  "story_element" => "story_clip_number"
}.freeze

errors = []
warnings = []

def front_matter(path)
  text = path.read
  match = text.match(/\A---\s*\n(.*?)\n---\s*\n/m)
  raise "missing YAML front matter" unless match

  data = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
  [data, text[match.end(0)..].to_s]
end

clip_ids = Set.new
clip_paths = {}

CLIPS.glob("*.md").sort.each do |path|
  begin
    data, body = front_matter(path)
  rescue StandardError => e
    errors << "#{path.relative_path_from(ROOT)}: #{e.message}"
    next
  end

  REQUIRED_FIELDS.each do |field|
    value = data[field]
    errors << "#{path.relative_path_from(ROOT)}: missing #{field}" if value.nil? || value.to_s.strip.empty?
  end

  errors << "#{path.relative_path_from(ROOT)}: layout must be clip" unless data["layout"] == "clip"
  errors << "#{path.relative_path_from(ROOT)}: clip must be true" unless data["clip"] == true

  id = data["clip_id"].to_s.strip
  next if id.empty?

  normalized_id = format("%02d", id.to_i)
  errors << "#{path.relative_path_from(ROOT)}: clip_id #{id.inspect} does not match filename" unless normalized_id == path.basename(".md").to_s
  errors << "#{path.relative_path_from(ROOT)}: duplicate clip_id #{normalized_id}" if clip_ids.include?(normalized_id)
  clip_ids << normalized_id
  clip_paths[normalized_id] = path

  image = CLIPS.join("assets", "photo", "#{normalized_id}.jpg")
  errors << "#{path.relative_path_from(ROOT)}: missing social/card image #{image.relative_path_from(ROOT)}" unless image.file?

  description_source = data["description"] || data["caption_html"] || body.gsub(/<[^>]*>/, " ").strip
  warnings << "#{path.relative_path_from(ROOT)}: add description, caption_html or reporting text for a story-specific social description" if description_source.to_s.strip.empty?

  COMPANION_FIELDS.each do |flag, target|
    next unless data[flag] == true
    errors << "#{path.relative_path_from(ROOT)}: #{flag} requires #{target}" if data[target].to_s.strip.empty?
  end
end

clip_paths.each do |id, path|
  data, = front_matter(path)
  COMPANION_FIELDS.each_value do |target|
    next if data[target].to_s.strip.empty?
    companion = format("%02d", data[target].to_i)
    errors << "#{path.relative_path_from(ROOT)}: #{target} points to missing clip #{companion}" unless clip_ids.include?(companion)
    errors << "#{path.relative_path_from(ROOT)}: #{target} points back to itself" if companion == id
  end
end

portfolio = YAML.safe_load(ROOT.join("_data", "portfolio.yml").read, aliases: true) || {}
featured = Array(portfolio["featured_ids"]).map { |value| format("%02d", value.to_i) }
errors << "_data/portfolio.yml: featured_ids contains duplicates" unless featured.uniq.length == featured.length
featured.each do |id|
  errors << "_data/portfolio.yml: featured clip #{id} does not exist" unless clip_ids.include?(id)
end

source_files = %w[index.html sitemap.xml].map { |path| ROOT.join(path) }
source_files += ROOT.join("_includes").glob("*.html").to_a
source_files += ROOT.join("_layouts").glob("*.html").to_a
source_files.each do |path|
  path.read.scan(/(?:href|canonical|og:url)=["']([^"']+)["']/i).flatten.each do |url|
    next unless url.match?(%r{(?:michalruprecht\.com)?/pages/(?:clips/\d+|ceramics)\.html(?:[?#]|\z)})
    errors << "#{path.relative_path_from(ROOT)}: internal link should be extensionless: #{url}"
  end
end

sitemap_source = ROOT.join("sitemap.xml").read
errors << "sitemap.xml: public URLs must not contain .html" if sitemap_source.match?(%r{<loc>.*\.html.*</loc>})

if errors.any?
  warn "Publishing check failed (#{errors.length} issue#{errors.length == 1 ? '' : 's'}):"
  errors.each { |error| warn "  - #{error}" }
  exit 1
end

if warnings.any?
  warn "Publishing check warnings (#{warnings.length}):"
  warnings.each { |warning| warn "  - #{warning}" }
end

puts "Publishing check passed for #{clip_ids.length} clips and #{featured.length} featured stories."
