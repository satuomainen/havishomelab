const Fastify = require('fastify');

const buildApp = () => {
    const app = Fastify({
        logger: true
    });

    app.get('/', async (request, reply) => {
        reply.type('application/json').code(200)
        return { hello: 'world' }
    });

    return app;
};


module.exports = buildApp;
