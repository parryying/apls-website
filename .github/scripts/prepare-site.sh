#!/usr/bin/env bash
set -euo pipefail

destination="${1:?Usage: prepare-site.sh DESTINATION}"
repository_root="$(git rev-parse --show-toplevel)"

pages=(
  after-school.html
  ap-prep.html
  calendar-print.html
  calendar.html
  contact.html
  enrollment-process.html
  enrollment.html
  events.html
  faq.html
  forms.html
  gallery.html
  index.html
  japanese.html
  kindergarten.html
  preschool.html
  programs.html
  saturday-school.html
  summer-camp.html
  tour.html
  tuition.html
  why-apls.html
)

pdfs=(
  "Chinese-Japanese MW-W afterschool classes-Fall 2026_Final.pdf"
  Emergency-Plan.pdf
  Health-Policy.pdf
  Kindergarten-1st-Grade-Application.pdf
  Parent-Handbook-2025.pdf
  Pesticide-Policy.pdf
  Preschool-Application.pdf
  "Sat. school classes_APLS_Fall 2026_Final.pdf"
  Summer-Camp-Application-2026.pdf
  Summer-Camp-Flyer-2026.pdf
  WA-Birth-to-5-Curriculum.pdf
)

rm -rf "$destination"
mkdir -p "$destination/pdfs"

for page in "${pages[@]}"; do
  cp "$repository_root/$page" "$destination/$page"
done

for file in .htaccess llms.txt robots.txt sitemap.xml; do
  cp "$repository_root/$file" "$destination/$file"
done

for directory in css data images js videos; do
  cp -R "$repository_root/$directory" "$destination/$directory"
done

node "$repository_root/scripts/prerender-tuition.js" "$destination"

for pdf in "${pdfs[@]}"; do
  cp "$repository_root/pdfs/$pdf" "$destination/pdfs/$pdf"
done

# Content Studio uploads land here, so they must ship without editing this list.
if [ -d "$repository_root/pdfs/uploads" ]; then
  cp -R "$repository_root/pdfs/uploads" "$destination/pdfs/uploads"
fi

find "$destination" -type f -printf '%P\n' | LC_ALL=C sort