'use strict';

import { expect } from 'chai';
import { unlinkMentions } from '../src/render';

describe('render', () => {
    describe('unlinkMentions', () => {
        it('should delete links from mentions and hashtags but not links', () => {
            const input = '<p>Hello hello <span class="h-card"><a href="https://mastodon.test/@user1" class="u-url mention">@<span>user1</span></a></span> what about <a href="https://mastodon.test/tags/hashtag" rel="tag">#<span>hashtag</span></a> from here: <a href="https://othersite.test/inside/page"><span>https://</span><span>othersite.te</span><span>st/inside/page</span></a></p>';
            const expected = '<p>Hello hello <span class="h-card"><em>@<span>user1</span></em></span> what about <em>#<span>hashtag</span></em> from here: <a href="https://othersite.test/inside/page"><span>https://</span><span>othersite.te</span><span>st/inside/page</span></a></p>';
            const actual = unlinkMentions(input);
            expect(actual).to.equal(expected, 'Links in user mentions and hashtags are replaced with <em>');
        });
    });
});
