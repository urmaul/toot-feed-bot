'use strict';

import { expect } from 'chai';
import { extractResponseError } from '../src/fediverse';

describe('fediverse', () => {
    specify('extractResponseError', () => {
        expect(extractResponseError('foo')).to.equal(undefined);
        expect(extractResponseError({})).to.equal(undefined);
        expect(extractResponseError({response:{data:42}})).to.equal(undefined);
        expect(extractResponseError({response:{data:{error:'oh hi'}}})).to.equal('oh hi');
        expect(extractResponseError({response:{data:{error:{message: 'oh hi'}}}})).to.equal('[object Object]');
    });
});
