import { logger } from './logger';
import { parse } from 'node-html-parser';
import { Entity } from 'megalodon';

export function renderMessage(status: Entity.Status): string {
    let content = unlinkMentions(status.content);

	return '<hr>' +
        `<p>` +
            account(status) +
            (status.reblog ? ` ♻️ ${account(status.reblog)}` : '') +
        `</p>` +
        content +
        status.media_attachments.map(renderMediaAttachment);
        //`<br><a href="${status.url}">🔗</a>`;
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

    return `<br>${icon} ${media.remote_url}`
}
