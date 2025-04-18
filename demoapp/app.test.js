const buildApp = require('./app.js');

describe('Demo app', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
    });

    test('returns hello', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({hello: 'world'});
    });
});
