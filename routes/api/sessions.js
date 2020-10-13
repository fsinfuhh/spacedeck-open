"use strict";

var config = require('config');
const db = require('../../models/db');

const util = require('util');
const uuidv4 = require('uuid/v4');
var crypto = require('crypto');
var URL = require('url').URL;
var ldap = require('ldapjs');
var ldap_client = ldap.createClient({
  url: config.get('ldap_url')
})

var express = require('express');
var router = express.Router();


router.post('/', function(req, res) {
  var data = req.body;
  if (!data.username || !data.password) {
    res.status(400).json({});
    return;
  }
  
  var username = req.body.username.toLowerCase();
  var password = req.body["password"];

  var createSession = function (user) {
    crypto.randomBytes(48, function (ex, buf) {
      var token = buf.toString('hex');

      var session = {
        user_id: user._id,
        token: token,
        ip: req.ip,
        device: "web",
        created_at: new Date()
      };

      db.Session.create(session)
        .error(err => {
          console.error("Error creating Session:", err);
          res.sendStatus(500);
        })
        .then(() => {
          var domain = (process.env.NODE_ENV == "production") ? new URL(config.get('endpoint')).hostname : req.headers.hostname;
          res.cookie('sdsession', token, {domain: domain, httpOnly: true});
          res.status(201).json(session);
        });
    });
  }

  ldap_client.bind(util.format(config.get('ldap_user_dn'), username), password, function (err) {
    if (err) {
      res.sendStatus(404);
    } else {
      db.User.findOne({where: {username: username}})
        .error(err => {
          res.sendStatus(404);
        })
        .then(user => {
          if (!user) {
            // User does not exist yet, create it
            crypto.randomBytes(16, function (ex, buf) {
              var token = buf.toString('hex');

              var user = {
                _id: uuidv4(),
                account_type: "ldap",
                username: username,
                prefs_language: req.i18n.locale,
                confirmation_token: token
              };

              db.User.create(user)
                .error(err => {
                  res.sendStatus(404);
                })
                .then(user => {
                  var homeFolder = {
                    _id: uuidv4(),
                    name: req.i18n.__("home"),
                    space_type: "folder",
                    creator_id: user._id
                  };
                  db.Space.create(homeFolder)
                    .error(err => {
                      res.sendStatus(404);
                    })
                    .then(homeFolder => {
                      user.home_folder_id = homeFolder._id;
                      user.save()
                        .then(() => {
                          createSession(user);
                        })
                        .error(err => {
                          res.sendStatus(404);
                        });
                    })
                });
            });
          } else {
            createSession(user);
          }
        })
    }
  });
});

router.delete('/current', function(req, res, next) {
  if (req.user) {
    var token = req.cookies['sdsession'];
    db.Session.findOne({where: {token: token}})
      .then(session => {
        session.destroy();
      });
    var domain = (process.env.NODE_ENV == "production") ? new URL(config.get('endpoint')).hostname : req.headers.hostname;
    res.clearCookie('sdsession', { domain: domain });
    res.sendStatus(204);
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
