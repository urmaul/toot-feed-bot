# TootFeedBot

A bot that forwards toots from your Fediverse feed to your matrix inbox. Supports Mastodon and Pleroma.

## Installation

The easiest way to run it is via Docker. This repository includes a Dockerfile so you can build a Docker image.

Example `docker-compose.yml` file (assuming you have a directory `code` with repository code and `data` for data):

```yaml
---
version: '3'
services:
  bot:
    build: code/
    container_name: "toot-feed-bot"
    environment:
      - APP_NAME=AnotherTootFeedBot
      - STORE_URI=sqlite://./data/store.sqlite3
      - STORE_SECRET=insert_a_long_random_string_here
      - MATRIX_SERVER_URL=insert_matrix_server_url_here
      - MATRIX_ACCESS_TOKEN=insert_access_token_here
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## Configuration

You can provide following environment variables to the application:

* `APP_NAME` – bot application name visible to users on fediverse login page and in active token list.
* `STORE_URI` – data store uri. Currently only sqlite is supported.
* `STORE_SECRET` – a key for encrypting all the store values. Insert a long random string here.
* `MATRIX_SERVER_URL` – insert the URL of a matrix server where the bot is registered. It will probably be https://matrix.org.
* `MATRIX_ACCESS_TOKEN` – access token for the bot's matrix account. Follow this instruction to create a bot and obtain an access token [https://t2bot.io/docs/access_tokens/](https://t2bot.io/docs/access_tokens/).

## Bot usage

### How to run subscription forwarding

1. Create a matrix room.
2. Invite the bot user.
3. Send `!reg <FediverseServerUrl>` message where `<FediverseServerUrl>` is the URL of your fediverse instance.
4. Follow the login link.
5. Allow the access to the bot application. Make sure it's a read-only access.
6. Copy the authorization token.
7. Pass the authorization token to the bot by sending by sending the `!auth <token>` message.
8. Done. The subscription has started.

### Commands

You can send commands by messaging them in the same woom with bot.

Supported commands are:

* `!reg <FediverseServerUrl>` generates a login link at the provided server.
* `!auth <token>` finishes logging in using provided auth token.
* `!retrieve <id>` retrieves and posts a toot by the instance internal id. Used for debugging.
* `!stop` stops the subscription, deletes all data, and revokes the access token.

## What about security?

### What is done for security

Bot stores the minimum amount of required data about you:

* Matrix room id
* Fediverse instance hostname and access token
* Last forwarded matrix and notification ids

Nothing else is neither stored nor submitted anywhere.

Every value in the database is encrypted. Encryption key is provided in the application configuration. Matrix room ids in the database keys are hashed.

Fediverse instance access tokens have read-only scope to limit the impact of possible leak.

### What can you do for security

You can send the `!stop` command to the bot and it will stop the subscription and delete all the saved data. It will also revoke the access token from your fediverse server.

Anyway the bot is open-source and it's easy to modify it to save your data. That's why you should not use the bot instances managed by people you don't trust. Better to run your own instance.
