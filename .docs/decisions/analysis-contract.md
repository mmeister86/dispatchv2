# Versionierter Analysevertrag

TASK-27 / TASK-28 · 2026-10-05 · Implementierungsentscheidung innerhalb der vom Nutzer übertragenen Entscheidungsfreiheit. Dies ist keine empirische Validierung, menschliche Eval-Abnahme oder Freigabe eines Provider-Datenpfads.

## Ein Score

`dispatch-score-v1` ist eine Inhaltsheuristik, keine Vorhersage von Reichweite, Interaktionen oder Umsatz. Berechnung ausschließlich in Dispatch aus gespeicherten Komponenten: Hook 0,20; Klarheit 0,20; Diskussionsfähigkeit 0,20; Originalität 0,15; natürliche CTA 0,05; Struktur 0,10; historische Passung 0,10. Summe mal 100; nur die Anzeige wird gerundet.

Fehlende Pflichtsignale oder unzureichende Teil-Confidence erzeugen keinen Gesamtscore. Ohne zulässiges historisches Messsignal wird ausschließlich die ausdrücklich gekennzeichnete Annahme `assumed_cold_start_baseline = 0.5` verwendet. Dieser Startwert ist weder gemessene historische Passung noch Audience Fit. Startschwellen und Gewichte bleiben versionierte, zu evaluierende Hypothesen.

Die Normalisierung prüft die tatsächliche gepinnte SDK-/API-Skala und das angefragte geordnete Kriterien-Set. Erwartete Indexwerte werden ohne Zwischenrundung auf 0..1 abgebildet; ungültige Werte werden abgelehnt und nicht in einen gültigen Bereich geklemmt. `noul` bleibt eine Wahrscheinlichkeit ohne erfundene Confidence.

## Zuordnung der bisherigen Dimensionen

| Bisherige Dimension | Verwendbares Signal und Darstellung |
| --- | --- |
| Audience Fit | Ohne eigenes definiertes Messsignal nicht verfügbar. Deklarierte Zielgruppe darf Kontext sein, ersetzt keine Messung. |
| Share Potential | Numerische Share-/Reichweitenprognose entfällt. Hook und Originalität heißen ausdrücklich so. |
| Conversation Potential | Semantische Diskussionsfähigkeit des Inhalts; keine prognostizierte Kommentaranzahl. |
| Follow Potential | Ohne evaluiertes eigenes Messsignal nicht verfügbar; CTA ist eine separat benannte Inhaltseigenschaft. |
| Dwell Potential | Keine Verweildauerprognose. Länge und Struktur bleiben deterministische Eigenschaften. |
| Discovery Potential | Keine Discovery-Prognose. Links, Hashtags und Mentions werden deskriptiv gezählt. |
| Content Health | Einzelne Promotion-/Claim-/Clickbait-Wahrscheinlichkeiten und harte Providerwarnungen; kein zweiter Aggregatscore. |

Follower-/Discovery-Reichweitenzahlen entfallen ohne getrennte gemessene Grundlage. Historische Analysen behalten ihre Formel-, Fragen-, Normalisierungs-, Profil-, Policy- und Input-Versionen; unterschiedliche Bedingungen erlauben keinen unkommentierten Scorevergleich.

## Struktur und Grenzen

`structure-v1`: pro Textsegment vier nachvollziehbare redaktionelle Prüfungen, deren Mittel anschließend über alle Segmente gemittelt wird: gültige aktuelle Provider-Textgrenze, höchstens drei Hashtags, höchstens drei Mentions, keine wiederholten normalisierten Absätze. Die Originaltexte bleiben unverändert. Dies sind redaktionelle Startannahmen und kein behauptetes Wissen über Plattformranking.

Die semantische Eingabe umfasst den gesamten geordneten Thread mit eindeutigen Segmentgrenzen. Überschreitet sie das begrenzte Inputbudget, ist die Bewertung unvollständig; es wird nicht still nur Segment 1 bewertet. Medien liefern belegte Typ-/Präsenz-/Alt-Metadaten, keine erfundene Bildinterpretation.

Analyzer, Routing, Verifikation und Network Fit haben getrennte standardmäßig ausgeschaltete Betriebsflags. Der tatsächliche EU-/Datenschutznachweis ist ein unabhängiges Tor. Analysefehler blockieren gültiges menschliches Publishing nicht. Annahme einer Empfehlung erzeugt eine neue Version ohne alte Freigabe und ohne Austausch eines bestehenden Termins.

## Geprüfter öffentlicher Quellenkontext

Der Quellenbericht [TASK-27/44](../reviews/task-27-44-public-x-source-review.md) wurde am 2026-10-05 unter der übertragenen Entscheidungsfreiheit geprüft. Der Startkontext `x-public-context-v1` verwendet ausschließlich öffentliche Codebelege aus `xai-org/x-algorithm` bei Commit `b412112d03f27acbfd668e0cc040abcafa1080c1` vom 2026-10-03, mit unveränderlichen Quellenlinks und Datei-Prüfsummen im Bericht. Die Primärquelle hat sich gegenüber dem historischen Repository `twitter/the-algorithm` geändert.

Entscheidung: Diesen Snapshot als geprüften Informationskontext übernehmen (`sourceScope=public_code`, `productionState=unknown`, `scoringInfluence=none`). Öffentliche Rankinggewichte werden nicht in `dispatch-score-v1` kopiert. Dies aktiviert weder den Analyzer noch einen Provider-Datenpfad; die technische Speicherung und Auswahl des Profil-Datensatzes folgt erst in TASK-27/44.

Eine erneute Quellenprüfung bis 2026-10-12 ist eine betriebliche Startannahme, keine belegte Plattformregel. Änderungen erzeugen einen deduplizierten Reviewvorschlag; Aktivierung und Rollback bleiben explizite, protokollierte Entscheidungen und ändern historische Bewertungen nicht.

Vor Produktabnahme bleiben tatsächlicher SDK-/Runtime-Durchstich, versionierte menschlich geprüfte Eval-Beispiele, technische Profilvalidierung und zulässiger Provider-Datenpfad erforderlich. Die öffentliche Quellenprüfung ersetzt keinen dieser Nachweise.
