// MIT License
// Copyright Peter Širka <petersirka@gmail.com>
// Version 1.02

var events = require('events');
var SUGAR = 'ABCD1234';
var USERAGENT = 20;

// expireCookie in days
// expireSession in minutes

function Users() {
	this.options = { cookie: '__user', secret: 'AbcUASOU389ASDadsl', expireSession: 10, expireCookie: 10, autoLogin: true };
	this.framework = null;
	this.online = 0;
	this.users = {};
}

Users.prototype.usage = function() {
	var self = this;
	return 'Online users: ' + self.online + ' ' + self.online.pluralize('users', 'user', 'users');
};

Users.prototype = new events.EventEmitter;

/*
	Authorize user
	@id {Number}
	@callback {Function} :: callback must have as parameter an object or null value
*/
Users.prototype.onAuthorization = null;

Users.prototype._onAuthorization = function(req, res, flags, callback) {

	var self = this;
	var framework = self.framework;
	var options = self.options;
	var cookie = req.cookie(options.cookie) || '';

	if (cookie === '' || cookie.length < 10) {
		callback(false);
		return;
	}

	var value = framework.decrypt(cookie, options.secret, false);
	if (value === null || value.length === 0) {
		callback(false);
		return;
	}

	var arr = value.split('|');

	if (arr[1] !== SUGAR || arr[2] !== req.headers['user-agent'].substring(0, USERAGENT).replace(/\s/g, '')) {
		callback(false);
		return;
	}

	var id = arr[0];
	var user = self.users[id];

	if (user) {
		user.expire = new Date().add('m', self.options.expireSession);
		req.user = user.user;
		callback(true);
		return;
	}else{
        	callback(false);
        	return;
	}

	self.onAuthorization(id, function(user) {

		if (!user || !options.autoLogin) {
			// remove cookie
			res.cookie(options.cookie, '', new Date().add('d', -1));
			callback(false);
			return;
		}

		req.user = user;
		self.users[id] = { user: user, expire: new Date().add('m', self.options.expireSession) };
		self.emit('login', id, user);
		callback(true);

	}, flags);

};

/*
	Login an user
	@controller {Controller}
	@id {Number}
	@user {Object}
	@expire {Number} :: expire in minutes
	return {Users}
*/
Users.prototype.login = function(controller, id, user, expire) {

	id = id.toString();

	var self = this;

	if (typeof(expire) !== 'number')
		expire = null;

	self.users[id] = { user: user, expire: new Date().add('m', expire || self.options.expireSession).getTime() };
	self.refresh();
	self.emit('login', id, user);
	self._writeOK(id, controller.req, controller.res);

	return self;
};

/*
	Logoff an user
	@controller {Controller}
	@id {Number}
	return {Users}
*/
Users.prototype.logoff = function(controller, id) {

	id = id.toString();

	var self = this;
	var user = self.users[id];

	delete self.users[id];
	self._writeNO(controller.res);

	self.refresh();
	self.emit('logoff', id, user || null);

	return self;
};

/*
	Change an user
	@id {Number}
	@newUser {Object}
	return {Users}
*/
Users.prototype.change = function(id, newUser) {

	id = id.toString();

	var self = this;
	var old = self.users[id];

	if (typeof(old) === 'undefined' || old === null)
		return self;

	self.users[id] = newUser;
	self.emit('change', id, newUsers, old || null);
	return self;
};

/*
	Internal
*/
Users.prototype.refresh = function() {
	var self = this;
	var keys = Object.keys(self.users);

	self.online = keys.length;
	self.emit('online', self.online);

	return self;
};

/*
	Internal
*/
Users.prototype.recycle = function() {

	var self = this;
	var keys = Object.keys(self.users);
	var length = keys.length;

	if (length === 0)
		return self;

	var expire = new Date();
	var users = self.users;

	for (var i = 0; i < length; i++) {
		var key = keys[i];
		var user = users[key];
		if (user.expire < expire) {
			self.emit('expire', key, user.user);
			delete users[key];
		}
	}

	self.refresh();
	return self;
};

/*
	Internal
*/
Users.prototype._writeOK = function(id, req, res) {
	var self = this;
	var framework = self.framework;
	var value = id + '|' + SUGAR + '|' + req.headers['user-agent'].substring(0, USERAGENT).replace(/\s/g, '') + '|';
	res.cookie(self.options.cookie, framework.encrypt(value, self.options.secret), new Date().add('d', self.options.expireCookie));
	return this;
};

/*
	Internal
*/
Users.prototype._writeNO = function(res) {
	var self = this;
	res.cookie(self.options.cookie, '', new Date().add('y', -1));
	return self;
};

module.exports = new Users();

module.exports.install = function(framework) {

	SUGAR = (framework.config.name + framework.config.version + SUGAR).replace(/\s/g, '');

	framework.onAuthorization = function(req, res, flags, callback) {

		if (users.onAuthorization !== null) {
			users._onAuthorization(req, res, flags, callback);
			return;
		}

		callback(false);
	};

	framework.on('service', function(counter) {
		if (counter % 3 === 0)
			users.recycle();
	});

	this.framework = framework;
};

var users = module.exports;
