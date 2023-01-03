import { logger } from './logger';
import { parse } from 'node-html-parser';
import { Entity } from 'megalodon';

export function renderMessage(status: Entity.Status): string {
    let byline =
        account(status) +
        (status.reblog ? ` ♻️ ${account(status.reblog)}` : '') +
        `:<br>`;

    let content = unlinkMentions(status.content);

    let blocks: string[] = status.media_attachments.map(renderMediaAttachment);
    
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
    const typeIcons = {'image': '🖼'};
    const icon = typeIcons[media.type] || '📦';

    if (!typeIcons[media.type]) {
        logger.debug(`Unknown attachment type "${media.type}"`);
    }

    return `${icon} ${media.remote_url}`
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
