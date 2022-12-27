'use strict';

import { expect } from 'chai';
import { renderPoll, unlinkMentions } from '../src/render';

describe('render', () => {
    describe('unlinkMentions', () => {
        it('should delete links from mentions and hashtags but not links', () => {
            const input = '<p>Hello hello <span class="h-card"><a href="https://mastodon.test/@user1" class="u-url mention">@<span>user1</span></a></span> what about <a href="https://mastodon.test/tags/hashtag" rel="tag">#<span>hashtag</span></a> from here: <a href="https://othersite.test/inside/page"><span>https://</span><span>othersite.te</span><span>st/inside/page</span></a></p>';
            const expected = '<p>Hello hello <span class="h-card"><em>@<span>user1</span></em></span> what about <em>#<span>hashtag</span></em> from here: <a href="https://othersite.test/inside/page"><span>https://</span><span>othersite.te</span><span>st/inside/page</span></a></p>';
            const actual = unlinkMentions(input);
            expect(actual).to.equal(expected, 'Links in user mentions and hashtags are replaced with <em>');
        });
    });

    describe('renderPoll', () => {
        it('should render polls', () => {
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
    });
});
