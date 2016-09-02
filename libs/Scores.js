var http = require("http");
var fs = require("fs");
var config = require("./config.js");

/*-----------------------------------------------------------------------------------------
|TITLE:    Scores.js
|PURPOSE:  Handles making API calls and processing data returned from the Facebook Graph
|      API.
|AUTHOR:  Lance Whatley
|CALLABLE METHODS:
|          get: make HTTP request to endpoint at ESPN for scores
|          parseFinalGames: takes the response from this.get() and parses out games
|              that have completed and their scores
|ASSUMES:
|REVISION HISTORY:
|      *LJW 12/5/2015 - created
-----------------------------------------------------------------------------------------*/
function Scores(sport) {
  //sports include: nfl,nba,ncf,ncb,mlb,nhl

  this.sport = sport || "nfl";
  this.endpoint = "www.espn.com";
  this.path = this.setPath(this.sport);
}

Scores.prototype.getAllFinalGames = function(cb,events) {
  events = events || [];
  var self=this;

  this.remainingEvents = this.remainingEvents || ["nfl","nba","ncf","ncb","nhl","mlb"];
  this.sport = this.remainingEvents[0];
  this.setPath(this.sport);

  this.get(function(_err,data) {
    if (_err) return cb(_err);
    self.parseFinalGames(data,function(__err,ret) {
      if (__err) {
        console.trace("Error parsing final games for sport '" + self.sport + "':",__err);
      } else {
        var o = {};
        o[self.sport] = ret;

        events.push(o);
      }

      self.remainingEvents.shift();

      if (self.remainingEvents.length) {
        self.getAllFinalGames(cb,events);
      } else {
        return cb(null,events);
      }
    });
  });
}

Scores.prototype.setPath = function(sport,raw) {
  this.path = (raw) ? sport : "/" + sport + "/bottomline/scores";
  return this;
}

Scores.prototype.parseFinalGames = function(response,callback) {
  var self = this;

  this.unserialize(response,function(err,oResponse) {
    if (err) return callback(err);

    try {
      var ret = [];
      for (var _key in oResponse) {
        if (_key.search(/^\w{1,8}_s_left\d{1,3}$/) > -1) {
          if (self.isFinal(oResponse[_key].toLowerCase())) {
            var formatted = oResponse[_key].replace(/([^\w\d\s\(\)'-\.]*)([\w\d\s\(\)'\-&\.]+\s\d{1,3})(\W*)(\s|\^)([\w\d\s\(\)'\-&\.]+\s\d{1,3})(.*)(\(.+\))(.*)/,"$2|$5");
            var teams = formatted.split("|");

            var o = {};
            for (var _i=0;_i<teams.length;_i++) {
              var team = teams[_i].replace(/^([\(\d\)\s]*)(.+)(\s)(\d{1,3})$/,"$2");
              var score = teams[_i].replace(/^([\(\d\)\s]*)(.+)(\s)(\d{1,3})$/,"$4");

              o[team] = Number(score);
            }

            ret.push(o);
          }
        }
      }

      return callback(null,ret);

    } catch(err) {
      return callback(err);
    }
  });
}

Scores.prototype.checkTeams = function(aliases,gameInfo) {
  var visitingAliases = aliases.visiting.split("|");
  var homeAliases = aliases.home.split("|");
  var team1 = Object.keys(gameInfo)[0];
  var team2 = Object.keys(gameInfo)[1];
  var team1score = gameInfo[team1];
  var team2score = gameInfo[team2];

  var checkTeam = function(aliases,team) {
    for (var _i=0;_i<aliases.length;_i++) {
      if (aliases[_i] == team) {
        return team;
      }
    }
    return false;
  }

  var v1 = checkTeam(visitingAliases,team1);
  var v2 = checkTeam(visitingAliases,team2);
  var h1 = checkTeam(homeAliases,team1);
  var h2 = checkTeam(homeAliases,team2);

  if (v1 && h2) {
    return {home:team2score,visiting:team1score};
  } else if (v2 && h1) {
    return {home:team1score,visiting:team2score};
  }

  return false;
}

Scores.prototype.isFinal = function(text) {
  var endOfGameText = ["(final)","(end of 4th)","(00:00 in 4th)","(final - ot)","(final - 2nd ot)","(final - 3rd ot)"];

  for (var _i=0;_i<endOfGameText.length;_i++) {
    if (text.search(endOfGameText[_i].toLowerCase()) > -1) {
      return true;
    }
  }

  return false;
}

Scores.prototype.unserialize = function(string,cb) {
  try {
    string = string || "";
    string=(/^\?/.test(string)) ? string.substring(1) : string;    //if first char is a question mark, remove it from the string

    var a=string.split("&");
    var obj={};
    for (var _i=0;_i<a.length;_i++) {
      var _a = a[_i].split("=");
      obj[ decodeURIComponent(_a[0] || "") ] = decodeURIComponent(_a[1] || "");
    }

    cb(null,obj);
  } catch(err) {
    cb(err);
  }
}

Scores.prototype.get = function(cb) {
  var self=this;

  var filePath = config.scores.path(this.sport);

  //check if we have a file that would contain the sport information locally first
  fs.readFile(filePath,{encoding:"utf8"},function(e,fileData) {
    if (e) {        //if no local file, go see if info exists at ESPN endpoint
      var options={
        hostname: self.endpoint,
        path: self.path,
        protocol: "http:",
        port: 80,
        method: "GET",
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      var req = http.get(options,
        function(res) {
          if (res.statusCode == 200) {
            var body='';
            res.on('data',function(chunk) {
              body += chunk;
            });
            res.on('end',function() {
              cb(null,body);
            });
          } else {
            cb("Bad response; status code: " + res.statusCode + "; headers: " + res.headers)
          }
        }
      ).on('error', function(e) {
        cb(e);
      });
    } else {
      cb(null,fileData);
      fs.unlink(filePath);
    }
  });
}

//-------------------------------------------------------
//NodeJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports=Scores;
}
//-------------------------------------------------------
