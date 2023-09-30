import { logger } from './logger';
import { parse } from 'node-html-parser';
import { Entity } from 'megalodon';

const typeIcons = {'image': '🖼', 'video': '🎞️', 'gifv': '🎞️'};

export function renderStatus(status: Entity.Status, titleTemplate: string = '{}'): string {
    const statusUrl: string = status.url !== null ? status.url : (status.reblog?.url ? status.reblog.url : status.uri);

    let name = `<b>${accountName(status.account)}` + (status.reblog ? ` ♻️ ${accountName(status.reblog.account)}` : '') + `</b>`;
    let title = summary(
        titleTemplate.replace('{}', name),
        `<p>🆔 <code>${status.id}</code><br>🔗 ${unlink(statusUrl)}</p>` +
        accountInfo(status.account) +
        (status.reblog ? accountInfo(status.reblog.account) : '')
    );

    let content = status.reblog ? renderStatusContent(status.reblog) : renderStatusContent(status);

    return title + content;
}

function renderStatusContent(status: Entity.Status): string {
    let content = unlinkMentions(status.content);

    let blocks: string[] = [];

    if (status.media_attachments.length > 0) {
        blocks.push(
            `<details>` +
            `<summary>${status.media_attachments.map(mediaIcon).join(" ")}</summary>` +
            `<p>` + status.media_attachments.map(renderMediaAttachment).join("<br>") + `</p>` +
            `</details>`
        );
    }
    
    const poll = status.poll || status.reblog?.poll;
    if (poll) {
        blocks.push(renderPoll(poll));
    }
    
	return content + blocks.join('<br>');
}

export function unlinkMentions(content: string): string {
    const html = parse(content);
    html
        .querySelectorAll('a[rel="tag"],a.mention,a.hashtag')
        .forEach((el) => el.replaceWith(`<em>${el.innerHTML}</em>`));

    return html.outerHTML;
}

function unlink(text: string): string {
    return text.replace(/\bhttps?:\/\//g, '');
}

function accountName(account: Entity.Account): string {
    return account.display_name || account.username;
}

export function accountInfo(account: Entity.Account): string {
    const noteHtml = parse(account.note);
    const link = unlink(account.url);
    const noteText = unlink(noteHtml.structuredText);

    return `<p>👤 <b>${accountName(account)}</b> <code>@${account.acct}</code> ${link}${noteText && '<br>'}${noteText}</p>`;
}

function renderMediaAttachment(media: Entity.Attachment): string {
    const url = media.remote_url || media.url;
    return `<a href="${url}">${mediaIcon(media)} ${media.description || url}</a>`;
}

function mediaIcon(media: Entity.Attachment): string {
    const icon = typeIcons[media.type] || '📦';

    if (!typeIcons[media.type]) {
        logger.debug(`Unknown attachment type "${media.type}" in ${media}`);
    }

    return icon;
}

export function renderPoll(poll: Entity.Poll): string {
    const optionEmoji = poll.multiple ? '☑️' : '🔘';
    return '🗳️:' + poll.options.map(
        (option) => {
            const votesLine = option.votes_count !== null ? ` (📊 ${option.votes_count})` : '';
            return `<br>${optionEmoji} ${option.title}${votesLine}`
        }
    ).join('');
}

function summary(title: string, content: string): string {
    return `<details><summary>${title}</summary><blockquote>${content}</blockquote></details>`;
}

export function renderNotification(notification: Entity.Notification): string | undefined {
    if (notification.type == 'poll_expired' && notification.status) {
        return renderStatus(notification.status, '🔔🗳️ Poll by {} expired');
    } else if (notification.type == 'follow' && notification.account) {
        return summary(
            `🔔🧑 <b>${notification.account.display_name}</b> follows you`,
            accountInfo(notification.account)
        );
    } else if (notification.type == 'mention' && notification.account && notification.status) {
        return renderStatus(notification.status, '🔔💬 {} mentioned you');
    } else if (notification.type == 'favourite' && notification.account && notification.status) {
        return summary(
            `🔔❤️ <b>${notification.account.display_name}</b> favourited your toot from ${notification.status.created_at}`,
            `<p>🔗 ${unlink(notification.status.uri)}</p>` +
            accountInfo(notification.account) +
            '<p>💬 ' + (notification.status.plain_content || unlinkMentions(notification.status.content)) + '</p>'
        );
    } else if (notification.type == 'reblog' && notification.account && notification.status) {
        return summary(
            `🔔♻️ <b>${notification.account.display_name}</b> reblogged your toot from ${notification.status.created_at}`,
            `<p>🔗 ${unlink(notification.status.uri)}</p>` +
            accountInfo(notification.account) +
            '<p>💬 ' + (notification.status.plain_content || unlinkMentions(notification.status.content)) + '</p>'
        );
    } else if (notification.type == 'move' && notification.account && notification.target) {
        return summary(
            `🔔💨 <b>${notification.account.display_name}</b> moved to <code>@${notification.target.acct}</code>`,
            accountInfo(notification.account) +
            accountInfo(notification.target)
        );
    } else {
        logger.debug(`Unknown notification type ${notification.type}`, notification);
        return undefined;
    }
}
