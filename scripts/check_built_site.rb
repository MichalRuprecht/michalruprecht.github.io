#!/usr/bin/env ruby
# frozen_string_literal: true

require "pathname"
require "set"

ROOT = Pathname.new(__dir__).join("..").expand_path
SITE = Pathname.new(ARGV.fetch(0, ROOT.join("_site").to_s)).expand_path
errors = []

unless SITE.directory?
  warn "Built-site check failed: #{SITE} does not exist"
  exit 1
end

clip_files = SITE.join("pages", "clips").glob("*.html").select { |path| path.basename.to_s.match?(/\A\d+\.html\z/) }
clip_urls = Set.new

clip_files.each do |path|
  id = path.basename(".html").to_s
  html = path.read
  expected_url = "https://michalruprecht.com/pages/clips/#{id}"
  clip_urls << expected_url

  canonical = html[/<link\s+rel=["']canonical["']\s+href=["']([^"']+)/i, 1]
  description = html[/<meta\s+name=["']description["']\s+content=["']([^"']*)/i, 1]
  og_image = html[/<meta\s+property=["']og:image["']\s+content=["']([^"']+)/i, 1]

  errors << "#{path.relative_path_from(SITE)}: canonical must be #{expected_url}" unless canonical == expected_url
  errors << "#{path.relative_path_from(SITE)}: missing meta description" if description.to_s.strip.empty?
  errors << "#{path.relative_path_from(SITE)}: social image must use #{id}.jpg" unless og_image.to_s.end_with?("/pages/clips/assets/photo/#{id}.jpg")
end

sitemap_path = SITE.join("sitemap.xml")
if sitemap_path.file?
  sitemap = sitemap_path.read
  locations = sitemap.scan(%r{<loc>([^<]+)</loc>}).flatten
  errors << "sitemap.xml: contains duplicate URLs" unless locations.uniq.length == locations.length
  locations.each { |url| errors << "sitemap.xml: URL must be extensionless: #{url}" if url.end_with?(".html") }
  clip_urls.each { |url| errors << "sitemap.xml: missing #{url}" unless locations.include?(url) }
else
  errors << "sitemap.xml was not generated"
end

SITE.glob("**/*.html").each do |path|
  path.read.scan(/href=["']([^"']+)["']/i).flatten.each do |url|
    next unless url.match?(%r{\A(?:https://michalruprecht\.com)?/pages/(?:clips/\d+|ceramics)\.html(?:[?#]|\z)})
    errors << "#{path.relative_path_from(SITE)}: internal link should be extensionless: #{url}"
  end
end

if errors.any?
  warn "Built-site check failed (#{errors.length} issue#{errors.length == 1 ? '' : 's'}):"
  errors.each { |error| warn "  - #{error}" }
  exit 1
end

puts "Built-site check passed for #{clip_files.length} clip pages."
