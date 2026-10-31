![Hydra Nexus — Extend your Hydra experience](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/promo/overview.jpg)

[English](../../README.md) · [Português (Brasil)](pt-BR.md) · [Español](es.md) · [Русский](ru.md) · [العربية](ar.md) · [Français](fr.md) · [Deutsch](de.md) · [Türkçe](tr.md) · [Polski](pl.md)

# Hydra Nexus

Hydra Nexus — расширение сообщества для Hydra Launcher в Windows. Оно добавляет управление хранилищем, аккаунты Steam для отдельных игр, историю игры, вкладки, заметки и свои фоны. Включайте нужные инструменты в Plugins. Интерфейс использует язык Hydra и нативные элементы вашей темы. Требуется установленный Hydra Launcher.

**[Скачать установщик](https://github.com/M0KA40/Hydra-Nexus/releases/latest/download/Hydra_Nexus_2.2.exe)** · [Примечания к выпуску](https://github.com/M0KA40/Hydra-Nexus/releases/tag/v2.2) · [Сообщить о проблеме](https://github.com/M0KA40/Hydra-Nexus/issues/new/choose)

## Steam launch settings

![Steam launch settings](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/ac0b8e5df56367c357d743ffb2c01ea4b1fc9c9a/assets/features/steam.webp)

Назначьте игре сохранённый аккаунт Steam и режим запуска. Default / standalone не просит Nexus запускать Steam или менять аккаунт; открытый сеанс не изменяется. Steam online использует личный аккаунт онлайн. Steam offline принудительно включает автономный режим выбранного, в том числе общего аккаунта. Доступны только сохранённые в Steam аккаунты. Для автоматического переключения отключите запрос выбора аккаунта при запуске Steam.

**Где открыть:** Library → game page → Steam button beside Play

## Game Storage Manager

![Game Storage Manager](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/storage.webp)

Просматривайте установленные игры по дискам, свободному месту и измеренному размеру. Ищите и сортируйте по размеру или последнему запуску. Открывайте папки или переносите игры после проверки назначения и места. Копии проверяются до обновления путей и удаления оригиналов. Неопределённые папки и неполные измерения помечаются. Записи других лаунчеров и ярлыки не изменяются.

**Где открыть:** Settings → below Big Picture → Game Storage Manager

## Play Activity

![Play Activity](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/activity.webp)

Просматривайте сеансы, время игры и дату последней игры. Недельные и месячные итоги показывают игры, активные дни и доступные достижения с датами. Настройте уведомления через колокольчик или отключите итоги и уведомления, сохранив учёт сеансов. Подробная история начинается с отслеживания Nexus; прежнее общее время не восстанавливает старые сеансы.

**Где открыть:** Sidebar → Play activity; per-game graph beside playtime



Храните отдельные точки восстановления сохранений и локальных достижений каждой игры. Восстанавливайте, открывайте папку или извлекайте проверенную копию без замены текущих сохранений. Добавляйте папки или останавливайте новые копии игры, сохраняя историю. Для облака выберите папку Google Drive для компьютеров: синхронизацией управляет Drive без входа в Google из Nexus. Закрывайте игры перед восстановлением. Локальное восстановление не открывает достижения аккаунта Steam/Epic.

**Где открыть:** Sidebar → Backup; game Options → General → Backup

## Extract Path

![Extract Path](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/extract.webp)

Загружайте архивы на один диск, а распаковывайте игру на другой. Включите автоматическую распаковку и выберите Extract path. Nexus запоминает последнее принятое назначение и путь каждой загрузки в очереди, создавая папку игры. Архивы остаются на месте для продолжения/раздачи, если отдельно не включено удаление после распаковки.

**Где открыть:** Download settings → automatic extraction → Extract path

## Download Finish Actions

![Download Finish Actions](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/finish.webp)

Выберите уведомление, сон или выключение ПК после всей очереди и включённых распаковок. Для отмены действий питания даётся 60 секунд. Новые загрузки возобновляют ожидание; закрытие Hydra отменяет действие. Включение плагина требует перезапуска, который не активирует действие питания автоматически.

**Где открыть:** Downloads → beside Cancel → Download Finish Actions

## Invisible Mode

![Invisible Mode](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/invisible.webp)

Управляйте передачей активности Hydra, сохраняя локальный прогресс и изображения. Включение плагина сразу активирует Invisible Mode; затем изменяйте режим в меню аккаунта. После отключения приватная активность остаётся локальной до явного возобновления передачи. Обновление присутствия может задерживаться, уведомления также зависят от серверов Hydra.

**Где открыть:** Account menu → below Friends → Invisible Mode

## Game Tabs

![Game Tabs](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/tabs.webp)

Открывайте страницы нескольких игр во вкладках одного окна. Результаты каталога, фильтры и прокрутка сохраняются. Нажмите правой кнопкой игру в каталоге или библиотеке → Open in New Tab; переключайтесь на панели, закрывайте через ×. Вкладки действуют в текущем сеансе и не восстанавливаются после полного перезапуска.

**Где открыть:** Catalogue or Library → right-click → Open in New Tab

## Custom backgrounds

https://github.com/user-attachments/assets/f69ff1b4-6250-43b1-a5d7-98ca3722d952

Выберите локальное изображение или видео для фона. Настройте затемнение и размытие, приостанавливайте видео при неактивной Hydra и возвращайте фон темы кнопкой Reset. Воспроизведение зависит от кодека; рекомендуются H.264 MP4 или WebM.

**Где открыть:** Hydra Nexus Settings → Themes → Choose image or video

## Другие инструменты

- Game Page Layout — Выбирайте разделы страниц игр и меняйте их порядок в Plugins.

- Game Notes — текст и ссылки для каждой игры, отдельное окно, поверх других окон и горячая клавиша фокуса.
- Nexus Mods — страница модов подходящей игры или поиск при отсутствии надёжного совпадения.
- PC Compatibility — сравнение подтверждённых характеристик с опубликованными минимальными требованиями; не прогноз FPS.
- Updater — проверка выпусков и установщика, обновление и перезапуск Hydra.

## Языки интерфейса

| Язык | Название на языке | Интерфейс Nexus |
| --- | --- | --- |
| en | English | ✓ Поддерживается |
| pt-BR | Português (Brasil) | ✓ Поддерживается |
| es | Español | ✓ Поддерживается |
| ru | Русский | ✓ Поддерживается |
| ar | العربية | ✓ Поддерживается |
| fr | Français | ✓ Поддерживается |
| de | Deutsch | ✓ Поддерживается |
| tr | Türkçe | ✓ Поддерживается |
| pl | Polski | ✓ Поддерживается |

## Установка и обновление

1. Скачайте Hydra_Nexus_2.2.exe в Releases.
2. Полностью закройте Hydra, включая значок в трее.
3. Запустите EXE и выберите Install / Update / Repair.
4. Откройте Hydra → Settings → Hydra Nexus → Plugins.

Отдельно устанавливать Node.js или Python для установщика не нужно. Настройки, заметки, история сохраняются. Если обновление Hydra заменит изменения, повторно примените совместимый Nexus. Проект независим от Hydra Launcher, Valve, Google и Nexus Mods. В сообщениях об ошибках указывайте версии и шаги воспроизведения.

## Информация

[Privacy](../../docs/privacy.md) · [Troubleshooting](../../docs/troubleshooting.md) · [Changelog](../../CHANGELOG.md) · [Contributing](../../CONTRIBUTING.md) · [MIT](../../LICENSE) · [Third-party notices](../../THIRD_PARTY_NOTICES.md)

## Сборка из исходников

```sh
python build.py
```
