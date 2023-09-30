'use strict';

import { Entity } from 'megalodon';

export const account: Entity.Account = {
    id: 'AAA',
    username: 'john',
    acct: 'john@mastodon.test',
    display_name: 'John Mastodon',
    locked: false,
    group: null,
    noindex: false,
    suspended: false,
    limited: false,
    created_at: '2022-11-30T09:25:01.000Z',
    followers_count: 0,
    following_count: 0,
    statuses_count: 1,
    note: '<p>John Mastodon, a mammal<br/><a href="https://mastodon.test/@john"><span>https://</span><span>mastodon.test/@john</span><span></span></a><br/><a href="https://johnmastodon.test/">https://johnmastodon.test/</a></p>',
    url: 'https://mastodon.test/@john',
    avatar: '',
    avatar_static: '',
    header: '',
    header_static: '',
    emojis: [],
    moved: null,
    fields: [],
    bot: false,
};