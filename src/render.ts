function account(status: Entity.Status): string {
	return `<b>${status.account.display_name}</b> <a href="${status.url}">${status.account.acct}</a>`;
}


export function renderMessage(status: Entity.Status): string {
	return '' +
        '<p>' +
            account(status) +
            (status.reblog ? ` ♻️ ${account(status.reblog)}` : '') +
        '</p>' +
        status.content +
        status.media_attachments.map((att) => `<p>${att.remote_url}</p>`);
}