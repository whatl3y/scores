var self = module.exports = {
  mysql: {
    creds: {
      host: "HOST",
      user: "USERNAME",
      password: "PASSWORD",
      database: "DATABASE"
    }
  },
  squairs: {
    unscoredEventsSql: "SQL TO GET UNSCORED EVENTS"
  },
  scores: {
    path: function(sport) {
      return "DIRECTORY TO STATIC FILES SAVED";
    }
  }
};