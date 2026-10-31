![Hydra Nexus — Extend your Hydra experience](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/promo/overview.jpg)

[English](../../README.md) · [Português (Brasil)](pt-BR.md) · [Español](es.md) · [Русский](ru.md) · [العربية](ar.md) · [Français](fr.md) · [Deutsch](de.md) · [Türkçe](tr.md) · [Polski](pl.md)

# Hydra Nexus

Hydra Nexus ist eine Community-Erweiterung für Hydra Launcher unter Windows. Sie ergänzt Speicherverwaltung, Steam-Konten pro Spiel, Spielaktivität, Tabs, Notizen und eigene Hintergründe. Aktivieren Sie die benötigten Werkzeuge unter Plugins. Nexus übernimmt Hydras Sprache und verwendet native, zum Theme passende Steuerelemente. Hydra Launcher muss bereits installiert sein.

**[Installer herunterladen](https://github.com/M0KA40/Hydra-Nexus/releases/download/v3.0/Hydra_Nexus.exe)** · [Versionshinweise](https://github.com/M0KA40/Hydra-Nexus/releases/tag/v3.0) · [Problem melden](https://github.com/M0KA40/Hydra-Nexus/issues/new/choose)

## Nexus Cloud · BETA

![Nexus Cloud](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/main/assets/features/cloud.webp)

Sichere unterstützte Spielstände und lokale Erfolge in deinem Dropbox- oder OneDrive-Konto. Verbinde einen Dienst im Browser, sichere ein Spiel oder alle geeigneten Spiele und aktiviere auf Wunsch Sicherungen nach dem Beenden. Verbinde auf diesem oder einem anderen PC dasselbe Konto, prüfe Kopien und Ziele und bestätige die Wiederherstellung.

Cloud nutzt deinen Kontospeicher. Optionale Passwortverschlüsselung schützt neue Pakete; bewahre das ursprüngliche Passwort außerhalb dieses PCs auf. Die Erkennung hängt von unterstützten Pfaden ab; manuelle Ordner sind möglich. Lokale Dateien schalten keine Steam- oder Epic-Erfolge frei.

**Wo zu finden: Einstellungen → Hydra Nexus → Plugins → Nexus Cloud; anschließend Nexus Cloud in der Seitenleiste öffnen.**

## Steam launch settings

![Steam launch settings](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/ac0b8e5df56367c357d743ffb2c01ea4b1fc9c9a/assets/features/steam.webp)

Ordnen Sie jedem Spiel ein gespeichertes Steam-Konto und einen Startmodus zu. Default / standalone fordert Nexus weder zum Starten von Steam noch zum Kontowechsel auf; eine laufende Sitzung bleibt unverändert. Steam online nutzt ein persönliches Konto online. Steam offline erzwingt den Offlinebetrieb des gewählten, auch gemeinsam genutzten Kontos. Es erscheinen nur bereits gespeicherte Konten. Deaktivieren Sie Steams Kontenauswahl beim Start für automatische Wechsel.

**Aufruf:** Library → game page → Steam button beside Play

## Game Storage Manager

![Game Storage Manager](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/1dedee7bd0a56fbe0db332a1fdb326ab8b46ac9a/assets/features/storage.webp)

Zeigen Sie installierte Spiele nach Laufwerk, freiem Platz und gemessener Dateigröße an. Suchen und sortieren Sie nach Größe oder letzter Nutzung. Öffnen Sie Ordner oder verschieben Sie ausgewählte Spiele nach Prüfung von Ziel und Platzbedarf. Kopien werden vor Pfadänderungen und Löschen der Originale geprüft. Unklare Ordner und Teilmessungen sind gekennzeichnet. Externe Launcher-Einträge und Desktopverknüpfungen werden nicht geändert.

**Aufruf:** Settings → below Big Picture → Game Storage Manager

## Play Activity

![Play Activity](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/activity.webp)

Sehen Sie Sitzungen, Spielzeit und das letzte Spieldatum. Wochen- und Monatsrückblicke zeigen Spiele, aktive Tage und verfügbare datierte Erfolge. Steuern Sie Hinweise über die Glocke oder deaktivieren Sie Rückblicke samt Hinweisen, ohne die Sitzungserfassung zu stoppen. Der Verlauf beginnt mit der Nexus-Erfassung; frühere Gesamtsummen rekonstruieren keine alten Sitzungen.

**Aufruf:** Sidebar → Play activity; per-game graph beside playtime



Bewahren Sie getrennte Wiederherstellungspunkte für Spielstände und lokale Erfolge auf. Stellen Sie einen Punkt wieder her, öffnen Sie seinen Ordner oder entpacken Sie eine geprüfte Kopie, ohne aktuelle Spielstände zu ersetzen. Ergänzen Sie Speicherordner oder stoppen Sie neue Sicherungen eines Spiels bei erhaltenem Verlauf. Für Cloudkopien wählen Sie einen Ordner von Google Drive für Desktop; Drive synchronisiert ohne Google-Anmeldung in Nexus. Schließen Sie Spiele vor der Wiederherstellung. Lokale Erfolge schalten keine Steam-/Epic-Kontoerfolge frei.

**Aufruf:** Sidebar → Backup; game Options → General → Backup

## Extract Path

![Extract Path](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/extract.webp)

Laden Sie Archive auf ein Laufwerk und entpacken Sie Spiele auf ein anderes. Aktivieren Sie automatisches Entpacken und wählen Sie Extract path. Nexus merkt sich das zuletzt akzeptierte Ziel und das Ziel jedes Warteschlangeneintrags; darin entsteht ein Spielordner. Archive bleiben für Fortsetzen/Seeding am Downloadort, sofern Sie ihr Löschen nach dem Entpacken nicht separat aktivieren.

**Aufruf:** Download settings → automatic extraction → Extract path

## Download Finish Actions

![Download Finish Actions](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/finish.webp)

Wählen Sie Hinweis, Energiesparmodus oder Herunterfahren nach Abschluss aller Downloads und aktivierten Entpackvorgänge. Für Energieaktionen bleiben 60 Sekunden zum Abbrechen. Neue Downloads setzen das Warten fort; Schließen von Hydra bricht die Aktion ab. Die Plugin-Aktivierung verlangt einen Neustart, der niemals automatisch eine Energieaktion scharf schaltet.

**Aufruf:** Downloads → beside Cancel → Download Finish Actions

## Invisible Mode

![Invisible Mode](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/invisible.webp)

Steuern Sie Hydras Aktivitätsfreigabe bei erhaltenem lokalem Fortschritt und Bildzugriff. Das Plugin aktiviert Invisible Mode sofort; ändern Sie ihn anschließend im Kontomenü. Private Aktivität bleibt nach dem Ausschalten lokal, bis Sie die Freigabe ausdrücklich fortsetzen. Präsenzänderungen können dauern; Spielhinweise hängen auch von Hydra-Servern ab.

**Aufruf:** Account menu → below Friends → Invisible Mode

## Game Tabs

![Game Tabs](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/tabs.webp)

Öffnen Sie mehrere Spielseiten in Tabs desselben Hydra-Fensters. Katalogergebnisse, Filter und Scrollposition bleiben erhalten. Rechtsklick im Katalog oder der Bibliothek → Open in New Tab; wechseln Sie über die Tab-Leiste und schließen Sie mit ×. Tabs gelten für die aktuelle Sitzung und werden nach vollständigem Neustart nicht wiederhergestellt.

**Aufruf:** Catalogue or Library → right-click → Open in New Tab

## Custom backgrounds

https://github.com/user-attachments/assets/f69ff1b4-6250-43b1-a5d7-98ca3722d952

Wählen Sie ein lokales Bild oder Video als Hintergrund. Passen Sie Abdunklung/Unschärfe an, pausieren Sie Videos bei inaktivem Hydra und stellen Sie den Theme-Hintergrund mit Reset wieder her. Videowiedergabe hängt vom Codec ab; empfohlen sind H.264 MP4 oder WebM.

**Aufruf:** Hydra Nexus Settings → Themes → Choose image or video

## Weitere Werkzeuge

- Game Page Layout — Wähle Spielseitenbereiche aus und ordne sie unter Plugins an.

- Game Notes — Text und Links pro Spiel, eigenes Fenster, immer im Vordergrund und Fokus-Tastenkürzel.
- Nexus Mods — passende Modseite öffnen oder bei unklarer Zuordnung suchen.
- PC Compatibility — bestätigte PC-Daten mit veröffentlichten Mindestanforderungen vergleichen; keine FPS-Vorhersage.
- Updater — Versionen prüfen, heruntergeladenen Installer verifizieren und Hydra aktualisieren/neustarten.

## Unterstützte Oberflächensprachen

| Sprache | Eigenbezeichnung | Nexus-Oberfläche |
| --- | --- | --- |
| en | English | ✓ Unterstützt |
| pt-BR | Português (Brasil) | ✓ Unterstützt |
| es | Español | ✓ Unterstützt |
| ru | Русский | ✓ Unterstützt |
| ar | العربية | ✓ Unterstützt |
| fr | Français | ✓ Unterstützt |
| de | Deutsch | ✓ Unterstützt |
| tr | Türkçe | ✓ Unterstützt |
| pl | Polski | ✓ Unterstützt |

## Installation und Update

1. Hydra_Nexus.exe unter Releases herunterladen.
2. Hydra vollständig samt Infobereichsymbol schließen.
3. EXE ausführen und Install / Update / Repair wählen.
4. Hydra → Settings → Hydra Nexus → Plugins öffnen.

Für den Installer sind Node.js und Python nicht separat erforderlich. Einstellungen, Notizen, Verlauf bleiben beim Update erhalten. Ersetzt ein Hydra-Update die Änderungen, wenden Sie eine kompatible Nexus-Version erneut an. Unabhängig von Hydra Launcher, Valve, Google und Nexus Mods. Fehlerberichte sollten Versionen und Reproduktionsschritte enthalten.

## Weitere Informationen

[Privacy](../../docs/privacy.md) · [Troubleshooting](../../docs/troubleshooting.md) · [Changelog](../../CHANGELOG.md) · [Contributing](../../CONTRIBUTING.md) · [MIT](../../LICENSE) · [Third-party notices](../../THIRD_PARTY_NOTICES.md)

## Aus Quellcode erstellen

```sh
python build.py
```
