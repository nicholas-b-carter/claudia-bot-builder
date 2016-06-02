/*global describe, it, jasmine, expect, beforeEach*/
var botBuilder = require('../lib/bot-builder'),
  https = require('https');
describe('Facebook Bot', function () {
  var messageHandler,
    underTest,
    lambdaContextSpy,
    singleMessageTemplate = {
      'object':'page',
      'entry':[
        {
          'id': 'PAGE_ID',
          'time': 1457764198246,
          'messaging':[
            {
              'sender':{
                'id':'USER_ID'
              },
              'recipient':{
                'id':'PAGE_ID'
              },
              'timestamp':1457764197627,
              'message':{
                'mid':'mid.1457764197618:41d102a3e1ae206a38',
                'seq':73,
                'text':'hello, world!'
              }
            }
          ]
        }
      ]
    };
  beforeEach(function () {
    messageHandler = jasmine.createSpy('messageHandler');
    lambdaContextSpy = jasmine.createSpyObj('lambdaContext', ['done']);
    underTest = botBuilder(messageHandler);
  });
  describe('API integration wiring', function () {
    describe('token verification', function () {
      it('uses the text/plain content type', function () {
        expect(underTest.apiConfig().routes.facebook.GET.success.contentType).toEqual('text/plain');
      });
      it('returns hub challenge if the tokens match', function () {
        underTest.router({
          context: {
            path: '/facebook',
            method: 'GET'
          },
          queryString: {
            'hub.verify_token': '12345',
            'hub.challenge': 'XHCG'
          },
          env: {
            facebookVerifyToken: '12345'
          }
        }, lambdaContextSpy);
        expect(lambdaContextSpy.done).toHaveBeenCalledWith(null, 'XHCG');
      });
      it('returns Error challenge if the tokens do not match', function () {
        underTest.router({
          context: {
            path: '/facebook',
            method: 'GET'
          },
          queryString: {
            'hub.verify_token': '123x',
            'hub.challenge': 'XHCG'
          },
          env: {
            facebookVerifyToken: '12345'
          }
        }, lambdaContextSpy);
        expect(lambdaContextSpy.done).toHaveBeenCalledWith(null, 'Error');
      });
    });
    describe('message handling', function () {
      it('sends the response using https to facebook', function (done) {

        var resolveHandler,
          handlerPromise = new Promise(function (resolve) {
            resolveHandler = resolve;
          });
        messageHandler.and.returnValue(Promise.resolve('YES'));
        underTest.router({
          context: {
            path: '/facebook',
            method: 'POST'
          },
          body: singleMessageTemplate,
          env: {
            facebookAccessToken: '12345'
          }
        }, lambdaContextSpy);

        resolveHandler('YES');
        handlerPromise.then(function () {
          https.request.respond('Thanks!', 200, 'OK');
          expect(https.request).toHaveBeenCalledWith({
            method: 'POST',
            hostname: 'graph.facebook.com',
            path: '/v2.6/me/messages?access_token=12345',
            port: 443,
            headers: { 'Content-Type': 'application/json' },
            body: '{"recipient":{"id":"USER_ID"},"message":{"text":"YES"}}'
          });
        }).then(done, done.fail);
      });
    });
  });
});
