# toot-feed-bot

A bot that forwards toots from your Fediverse feed to your matrix inbox.

## Installation

The easiest way to run it is via Docker.

TBD

## Configuration

TBD

### Creating a Matrix bot

TBD

## Bot usage

### How to run subscription forwarding

TBD

### Commands

You can send commands by messaging them in the same woom with bot.

Supported commands are:

* `!reg <FediverseServerUrl>` generates a login link at the provided server.
* `!auth <token>` finishes logging in using provided auth token.
* `!retrieve <id>` retrieves and posts a toot by the instance internal id. Used for debugging.
* `!stops` stops the subscription, deletes all data, and revokes the access token.

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
