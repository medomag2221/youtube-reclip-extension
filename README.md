# YouTube → ReClip

A Chrome/Edge extension that sends a selected YouTube video to your self-hosted
[ReClip](https://github.com/medomag2221/reclip) server, then downloads the finished
file to the `YouTube` subfolder of your browser's download directory.

## Features

- **Download to PC** button beside the watch-page actions/save button.
- The same action as the **first item** in a video card's three-dot menu.
- Unicode filenames, including Cyrillic; invalid Windows filename characters are sanitized.
- Persistent task queue,30-second background polling, download status popup and “Show in folder”.
- History keeps the latest eight finished/failed tasks. Clear all history or remove
  one entry from the popup without deleting files or cancelling active downloads.
- One menu entry even when YouTube nests popup/list renderers.
- No automatic playback, account access, cookies, likes or view-count manipulation.

## Install

1. Download/clone this repository to a permanent folder.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Reload your YouTube tabs. Pin the extension if you want quick access to task statuses.

The extension is not published in a browser store. Keep its folder in place.
After updating files, click **Reload** on the extension card and reload YouTube.

## Server configuration

The default endpoint is `http://server-home.lan/reclip/api/`. It matches our deployment,
but you must resolve that hostname and run ReClip there yourself. No server is provided.

For a different hostname/path, change `API` in `background.js`, the ReClip link in
`popup.html`, and `host_permissions` in `manifest.json`, then reload the extension.
Grant only your ReClip server's origin. The recommended server fork includes Deno
and browser impersonation dependencies; the extension also uses the upstream API.

The browser must reach the server over your LAN or another configured route.
Downloading from YouTube happens on the ReClip server, using that server's network route.
Files are saved in `YouTube/<video title>.<extension>`. Existing filenames are uniquified.
Your browser's “Ask where to save each file” setting may still display a save dialog.

## Privacy and permissions

| Permission | Why |
| --- | --- |
| YouTube content script | Insert buttons and read only the selected video's URL/title |
| ReClip host access | Start/check jobs and retrieve completed files |
| downloads | Save the file and reveal it in the file manager |
| storage | Keep the local task queue across service-worker restarts |
| alarms | Poll jobs while the YouTube tab is closed |

There is no telemetry, remote code or Google login. Task URL/title/status are stored
locally; the selected URL/title are sent to your configured ReClip server when you click
Download. The extension never opens a player automatically.

Upgrading to 1.0.2 trims old history automatically. Active tasks are retained
separately and may appear in addition to the eight history entries. Clearing this
history does not erase the browser's Downloads list or the ReClip server journal.

## Limitations

- Chromium browsers only; not packaged/tested for Firefox.
- Keep the browser running for background downloads. ReClip's in-memory jobs disappear when it restarts.
- YouTube changes its DOM: button selectors may need updates. DOM fixture tests are not a guarantee for every live UI experiment.
- ReClip's upstream five-minute download timeout remains. Long videos or slow transfers can fail.
- This extension does not control server-side retention. Our separate deployment expires server copies after24 hours; a stock installation may retain them indefinitely.
- Private/age-restricted/geoblocked videos or upstream extractor changes may require additional server configuration. No cookies are imported by this extension.

## Development

No build step or production dependencies. Load the repository root directly.

```sh
npm ci
npm test
```

Tests mock browser APIs and cover Cyrillic/Windows filenames, valid video URLs,
duplicate tasks, persisted queues, completion, selected-card behavior, nested menus,
first-item placement and duplicate repair. jsdom is a development dependency only.
Additionally, a public19-second YouTube video was downloaded through the deployed
ReClip API with a Cyrillic filename on2026-10-04. Installation in your own browser
is still needed to verify its current YouTube layout.

## Русский

Расширение добавляет «Скачать на ПК» рядом с сохранением и первым пунктом меню «⋮».
Видео готовится на вашем ReClip, затем скачивается в `Загрузки/YouTube` с исходным
названием, включая кириллицу. Статусы — по значку расширения.

В истории остаются последние 8 завершённых загрузок и ошибок. «Очистить историю»
удаляет их все; «Удалить запись» — одну. Скачанные файлы не удаляются, активные
задачи сохраняются отдельно. Старые записи сокращаются сразу после обновления.

Установка: `chrome://extensions` или `edge://extensions` → «Режим разработчика» →
«Загрузить распакованное» → папка с `manifest.json` → обновить YouTube.
Если ReClip расположен не на `server-home.lan/reclip/`, настройте адрес в файлах,
указанных выше. Ни лайки, ни автоматическое воспроизведение не выполняются.

## License

MIT. This is an independent companion project, not affiliated with YouTube or Google.
