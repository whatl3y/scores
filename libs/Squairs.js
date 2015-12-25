var http = require("http");
var mysql = require("mysql");
var config = require("./config.js");

/*-----------------------------------------------------------------------------------------
|TITLE:		Squairs.js
|PURPOSE:	
|AUTHOR:	Lance Whatley
|CALLABLE METHODS:
|					
|ASSUMES:	
|REVISION HISTORY:	
|			*LJW 12/6/2015 - created
-----------------------------------------------------------------------------------------*/
function Squairs(opts) {
	var self=this;
	opts = opts || {};
	
	this.connection = mysql.createConnection({
		host: opts.host,
		user: opts.user,
		password: opts.password,
		database: opts.database
	});
}

Squairs.prototype.connect = function(cb) {
	this.connection.connect(function(e) {
		if (typeof cb === "function") {
			cb(e);
		}
	});
}

Squairs.prototype.postScore = function(info,cb) {
	var self=this;
	
	var postData={
		type: "storeResult",
		template: info.templateID,
		scores: {
			home: info.home,
			visiting: info.visiting
		}
	};
	postData = this.serialize(postData);
	
	var options={
		hostname: config.squairs.domain,
		path: config.squairs.postScorePath,
		protocol: "http:",
		port: 80,
		method: "POST",
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': postData.length
		}
	};
	
	var req = http.request(options,
		function(res) {
			var body='';
			res.on('data',function(chunk) {
				body+=chunk;
			});
			res.on('end',function() {
				if (typeof cb==='function') cb(null,body,info);
			});
		}
	).on('error', function(e) {
		cb(e);
	});
	
	req.write(postData);
	req.end();
};

Squairs.prototype.serialize = function(obj) {
	var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

	for(name in obj) {
		value = obj[name];

		if(value instanceof Array) {
			for(i=0; i<value.length; ++i) {
				subValue = value[i];
				fullSubName = name + '[' + i + ']';
				innerObj = {};
				innerObj[fullSubName] = subValue;
				query += this.serialize(innerObj) + '&';
			}
		}
		else if(value instanceof Object) {
			for(subName in value) {
				subValue = value[subName];
				fullSubName = name + '[' + subName + ']';
				innerObj = {};
				innerObj[fullSubName] = subValue;
				query += this.serialize(innerObj) + '&';
			}
		}
		else if(value !== undefined && value !== null)
			query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
	}

	return query.length ? query.substr(0, query.length - 1) : query;
};

//-------------------------------------------------------
//NodeJS
if (typeof module !== 'undefined' && module.exports) {
	module.exports=Squairs;
}
//-------------------------------------------------------
