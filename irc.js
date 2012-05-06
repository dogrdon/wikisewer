//imports

var fs = require('fs'),
	path = require('path'),
	irc = require('irc-js'),
	redis = require('redis').createClient();

function listen(config, callback){
	channels = [];
	for (var channel in config.wikipedias){ 
		channels.push(channel);
	}

	var client = new irc({
		server: 'irc.wikimedia.org',
		nick: config.ircNick,
		log: config.log,
		user: {
			username: config.ircUserName,
			realname: config.ircRealName
		}
	});

	client.connect(function(){
		client.join(channels);
		client.on('privmsg', function(msg){
			m = parse_msg(msg.params, config);
			if (m){
				callback(m);
				//stats(m);
			}
		});
	});

}

function parse_msg(msg, config){
	//this regex is fairly impenetrable
	//need to come back to this and figure out what it's doing

	var m = /\x0314\[\[\x0307(.+?)\x0314\]\]\x034 (.*?)\x0310.*\x0302(.*?)\x03.+\x0303(.+?)\x03.+\x03 (.*) \x0310(.*)\x03?.*/.exec(msg[1]);
	if (! m){
		console.log("could not parse: " + msg);
		return null;
	}

	//number of characters edited - to int
	if (m[5]) {
		var delta = parseInt(/([+-]\d+)/.exec(m[5])[1]);

	} else {
		var delta = null;
	}

	//anonymous edit check
	var user = m[4];
	//if user is any ip address, it's anonymous
	var anonymous = user.match(/\d+.\d+.\d+.\d+/) ? true : false;

	//parsing flags
	var flag = m[2];
	var isRobot = flag.match(/B/) ? true:false;
	var isNewPage = flag.match(/N/) ? true:false;
	var isUnpatrolled = flag.match(/!/) ? true:false;
	var isMinor = flag.match(/M/) ? true:false;

	var page = m[1];
	var wikipedia = msg[0];
	var wikipediaUrl = 'http://' + wikipedia.replace('#', '') + '.org';
	var pageUrl = wikipediaUrl + '/wiki/' + page.replace(/ /g, '_');
	var userUrl = wikipediaUrl + '/wiki/User:' + user;
	var namespace = getNamespace(wikipedia, page, config);

	
	/*TODO - once our copy is working, will wrap this in a codition
	only to output objects where the comments contain 'revert' */ 
	return {
		flag: flag,
		page: page,
		pageUrl: pageUrl,
		url: m[3],
		delta: delta,
		//grab msgs only if the comments contain 'revert'
		comment: m[6],
		wikipedia: wikipedia,
		wikipediaUrl: wikipediaUrl,
		wikipediaShort: config.wikipedias[msg[0]].short,
		wikipediaLong: config.wikipedias[msg[0]].long,
		user: user,
		userUrl: userUrl,
		unpatrolled: isUnpatrolled,
		anonymous: anonymous,
		robot: isRobot,
		namespace: namespace,
		minor: isMinor
	}
}

function getNamespace(wikipedia, page, config){
	ns = null;
	var parts = page.split(':');
	if (parts.length > 1 && parts[1][0] != " "){
		ns = config['wikipedias'][wikipedia]['namespaces'][parts[0]];
		if (! ns) ns = "wikipedia";
	} else {
		ns = 'article';
	}
	return ns;
}

exports.listen = listen;