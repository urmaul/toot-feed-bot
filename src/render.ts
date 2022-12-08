export function renderMessage(status: Entity.Status): string {
    return '' +
        `<p><b>${status.account.display_name}</b> <a href="${status.url}">${status.account.acct}</a></p>` +
        status.content +'';
        // status.media_attachments.map((att) => `<p>${att.remote_url}</p>`);
}