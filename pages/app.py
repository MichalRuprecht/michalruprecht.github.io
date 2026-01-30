import requests
from bs4 import BeautifulSoup
import streamlit as st

st.set_page_config(page_title="NPR Newsletter Extractor")

st.title("NPR Newsletter Extractor")
url = st.text_input("Paste NPR story URL")

def extract(html, url):
    soup = BeautifulSoup(html, "html.parser")

    def meta(prop=None, name=None):
        if prop:
            tag = soup.find("meta", property=prop)
        else:
            tag = soup.find("meta", attrs={"name": name})
        return tag["content"].strip() if tag and tag.get("content") else ""

    headline = meta(prop="og:title")
    teaser = meta(name="description")
    photo = meta(prop="og:image")
    link = meta(prop="og:url") or url

    authors = meta(name="cXenseParse:author")
    if authors:
        people = [a.strip() for a in authors.split("|")]
        if len(people) == 1:
            teaser_with_author = f"{teaser}. {people[0]} reports for NPR."
        else:
            teaser_with_author = f"{teaser}. {' and '.join(people)} report for NPR."
    else:
        teaser_with_author = teaser

    return headline, link, photo, teaser, teaser_with_author

if url:
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        headline, link, photo, teaser, teaser_auth = extract(r.text, url)

        st.subheader("Results")
        st.text_area("Headline", headline)
        st.text_area("Link", link)
        st.text_area("Photo", photo)
        st.text_area("Teaser", teaser)
        st.text_area("Teaser with author", teaser_auth)

    except Exception as e:
        st.error(f"Failed to fetch story: {e}")
