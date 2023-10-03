'use strict';

import { expect } from 'chai';
import { accountInfo, renderNotification, renderPoll, unlinkMentions } from '../src/render';
import * as fixtures from './fixtures';
import { Entity } from 'megalodon';

describe('render', () => {
    describe('unlinkMentions', () => {
        it('should delete links from mentions and hashtags but not links', () => {
            const input = '<p>Hello hello <span class="h-card"><a href="https://mastodon.test/@user1" class="u-url mention">@<span>user1</span></a></span> what about <a href="https://mastodon.test/tags/hashtag" rel="tag">#<span>hashtag</span></a> from here: <a href="https://othersite.test/inside/page"><span>https://</span><span>othersite.te</span><span>st/inside/page</span></a></p>';
            const expected = '<p>Hello hello <span class="h-card"><em>@<span>user1</span></em></span> what about <em>#<span>hashtag</span></em> from here: <a href="https://othersite.test/inside/page"><span>https://</span><span>othersite.te</span><span>st/inside/page</span></a></p>';
            const actual = unlinkMentions(input);
            expect(actual).to.equal(expected, 'Links in user mentions and hashtags are replaced with <em>');
        });

        it('should also delete links from pleroma-style hashtags', () => {
            const input = '<p>Check <a href="https://mastodon.test/tags/hashtag" class="hashtag">#<span>hashtag</span></a></p>';
            const expected = '<p>Check <em>#<span>hashtag</span></em></p>';
            const actual = unlinkMentions(input);
            expect(actual).to.equal(expected);
        });
    });

    specify('renderPoll', () => {
        const poll: Entity.Poll = {
            expired: false,
            expires_at: '2022-12-27T21:44:19.000Z',
            id: 'AR2LJmfnLuL7ckyUGe',
            multiple: false,
            options: [
                { title: 'Foo', votes_count: 148 },
                { title: 'Bar Bar', votes_count: null },
                { title: 'Bazzz', votes_count: 82 }
            ],
            voted: false,
            votes_count: 409
        };
        const expected =
            '🗳️:' +
            '<br>🔘 Foo (📊 148)' +
            '<br>🔘 Bar Bar' +
            '<br>🔘 Bazzz (📊 82)';
        const actual = renderPoll(poll);
        expect(actual).to.equal(expected);
    });

    describe('accountInfo', () => {
        it('renders a normal account with links in note', () => {
            const actual = accountInfo(fixtures.account);
            const expected = '<p>👤 <b>John Mastodon</b> <code>@john@mastodon.test</code> mastodon.test/@john<br>John Mastodon, a mammal\nmastodon.test/@john\njohnmastodon.test/</p>';
            expect(actual).to.equal(expected);
        });

        it('renders an account with empty display_name and note', () => {
            const actual = accountInfo({
                ...fixtures.account,
                display_name: '',
                note: '',
            });
            const expected = '<p>👤 <b>john</b> <code>@john@mastodon.test</code> mastodon.test/@john</p>';
            expect(actual).to.equal(expected);
        });
    });

    describe('renderNotification', () => {
        const summaryOf = (str: string) => [...str?.matchAll(/.*<summary>(.*)<\/summary>.*/g)!][0][1];

        it('renders "reblog" notifications', () => {
            const notification: Entity.Notification = {
                ...fixtures.emptyNotification,
                type: 'reblog',
                status: fixtures.status,
            }
            const expected = '🔔♻️ <b>John Mastodon</b> reblogged your toot from 2022-11-30T09:26:01.000Z';
            const actual = renderNotification(notification)!;
            expect(summaryOf(actual)).to.equal(expected);
        });

        it('renders "move" notifications', () => {
            const notification: Entity.Notification = {
                ...fixtures.emptyNotification,
                type: 'move',
                target: {
                    ...fixtures.account,
                    acct: 'john@mastodonna.test',
                }
            }
            const expected = '🔔💨 <b>John Mastodon</b> moved to <code>@john@mastodonna.test</code>';
            const actual = renderNotification(notification)!;
            expect(summaryOf(actual)).to.equal(expected);
        });
    });
});
