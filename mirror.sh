#!/bin/bash


wget -m http://localhost:8080/index.html
wget -m http://localhost:8080/favicon.ico
wget -m http://localhost:8080/impressum.html
wget -m http://localhost:8080/index.css
wget -m http://localhost:8080/veranstaltungen
wget -m http://localhost:8080/dtb-logo-red.svg

[ -L srcdir ] || ln -s localhost:8080 srcdir

veranstaltungen=$( jq '.[].id' < localhost\:8080/veranstaltungen )
for v in $veranstaltungen; do
    wget -m http://localhost:8080/veranstaltung/$v/wettkaempfe
    wettkaempfe=$( jq '.[].id' < localhost\:8080/veranstaltung/$v/wettkaempfe )
    for wk in $wettkaempfe; do
        wget -m http://localhost:8080/veranstaltung/$v/wettkampf/$wk/uebungen
    done
done

destination=$( yq -r .mirror.destination < config.yaml )
rsync -avz srcdir/* $destination
