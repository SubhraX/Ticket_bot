# 🎫 Advanced Discord Ticket Bot

A robust, self-hosted Discord ticket management bot built with Node.js and `discord.js`. This bot features a built-in Express web server to host and view high-quality HTML transcripts directly from your own domain, an automated inactivity closure engine, and SQLite database integration for state management.

## ✨ Features

* **Custom Web Viewer:** Hosts HTML ticket transcripts via a built-in Express server, allowing direct URL access without relying on third-party transcript hosting.
* **Auto-Close Engine:** Background timer automatically checks the SQLite database every 60 seconds to archive or delete abandoned tickets based on customizable guild configurations.
* **Rich Transcripts:** Captures message history, images, and correctly renders user role colors and avatars (requires Member intents).
* **Automated Setup:** Automatically creates necessary directories (like `/transcripts`) on startup to prevent crash loops.
* **SQLite Database:** Lightweight local storage for tracking open tickets, channel IDs, and server-specific configurations (`guild_config`).

---

## 📋 Prerequisites

Before you begin, ensure you have the following:

1. **Node.js**: Version 20.x or higher.
2. **Discord Bot Application**: Created via the [Discord Developer Portal](https://discord.com/developers/applications).
3. **Privileged Intents Enabled**:
* Navigate to your bot in the Developer Portal > **Bot** tab.
* Turn **ON** the following intents:
* `Message Content Intent` (For reading ticket messages)
* `Server Members Intent` (Crucial for rendering correct user names, avatars, and role colors in HTML transcripts)





---

## ⚙️ Installation & Setup

**1. Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY

```

**2. Install dependencies**

```bash
npm install

```

**3. Configure Environment Variables**
Create a new file named `.env` in the root directory of your project and add the following configuration:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_bot_application_id_here

# Web Server Configuration
# If hosting on HostMc or a panel, set this to your assigned container port
PORT=25568 

```

**4. Start the Application**

```bash
node index.js

```

If successful, the console will output:

> 🌐 Web viewer active on port 25568
> Logged in as YourBotName#1234
> Successfully registered global slash commands.

---

## ☁️ Hosting on HostMc (or Pterodactyl Panels)

If deploying this bot on HostMc or a similar Pterodactyl-based panel, follow these specific deployment steps:

1. **Upload Files:** Upload all project files to the `/home/container` directory, or use Git integration to pull your repository directly via the console.
2. **Network/Port Configuration:** Navigate to the **Network** or **Ports** tab in your panel and note your assigned port (e.g., `25568`). Ensure your `.env` file's `PORT` variable matches this number so the Express server binds correctly.
3. **Transcript URLs:** Open `events/interactionCreate.js` and `index.js`, and ensure the `webUrl` string matches your panel's assigned IP or domain (e.g., `[http://sg.hostmc.in:25568/transcripts/](http://sg.hostmc.in:25568/transcripts/)`).
4. **Start the Bot:** Click the **Start** button in the console. The panel daemon will automatically pull the Node.js Docker image and execute `node index.js`.

---

## 📂 Project Structure

* `/commands/` - Contains slash command definitions and execution logic.
* `/events/` - Contains event listeners (e.g., `interactionCreate.js` for handling ticket buttons and transcript generation).
* `/transcripts/` - Auto-generated directory where HTML and TXT transcripts are stored and served by Express.
* `index.js` - Main entry point; handles command registration, event binding, the auto-close timer loop, and the Express web server.
* `database.js` - SQLite connection and table initialization.

## 🛠️ Tech Stack

* **Runtime:** Node.js v20+
* **Discord API:** `discord.js` v14, `@discordjs/rest`
* **Web Server:** `express`
* **Transcripts:** `discord-html-transcripts`
* **Database:** `sqlite3`
