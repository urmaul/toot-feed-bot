import { logger } from './logger';
import { parse } from 'node-html-parser';
import { Entity } from 'megalodon';

const typeIcons = {'image': '🖼'};

export function renderMessage(status: Entity.Status): string {
    let byline =
        `<p>` +
            account(status) +
            (status.reblog ? ` ♻️ ${account(status.reblog)}` : '') +
        `:</p>`;

    let content = unlinkMentions(status.content);

    let blocks: string[] = [];

    if (status.media_attachments.length > 0) {
        blocks.push(
            `<details>` +
            `<summary>${status.media_attachments.map(mediaIcon).join(" ")}</summary>` +
            status.media_attachments.map(renderMediaAttachment).join("<br>") +
            `</details>`
        );
    }
    
    const poll = status.poll || status.reblog?.poll;
    if (poll) {
        blocks.push(renderPoll(poll));
    }
    
	return byline + content + blocks.join('<br>');
}

export function unlinkMentions(content: string): string {
    const html = parse(content);
    html
        .querySelectorAll('a[rel="tag"],a.mention')
        .forEach((el) => el.replaceWith(`<em>${el.innerHTML}</em>`));

    return html.outerHTML;
}

function account(status: Entity.Status): string {
	return `<b>${status.account.display_name}</b> (${status.account.acct})`;
}

function renderMediaAttachment(media: Entity.Attachment): string {
    return `<a href="${media.remote_url}">${mediaIcon(media)} ${media.description || media.remote_url}</a>`;
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
