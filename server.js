var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')
var rp = require("request-promise");
var request = require('request');

//For cache purpose
const NodeCache = require("node-cache");
const resultsCache = new NodeCache({ stdTTL: 300, checkperiod: 600 });
const hash = require("json-hash");


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

const YELLO_PAGE_API_URL = "http://eksercise-api.herokuapp.com/";;
const TOKEN = "e36d26e9-d07d-4965-9d62-da6c2880e2a7";
const DEBUG = true;

/**
 * The search API
 * Get the query id and send it to fetch the persons results
 */
app.get('/api/v1/search', [getQueryId, getPersons]);

/**
 * Get the query id from people/search by sending the search query
 * @param {*} request 
 * @param {*} response 
 * @param {*} next 
 */
function getQueryId(request, response, next) {
  var query = request.query.q;
  var pageNum = request.query.page;
  var jsonSearchQuery = getJSONSearchQuery(query,pageNum);
  request.jsonSearchQuery = jsonSearchQuery;

  // No taste to continue with empty search query
  if (Object.keys(jsonSearchQuery).length === 0) {
    response.send([]);
    return;
  }

  // See if we can get the query from cache
  cachedResult = getCache(request.jsonSearchQuery);
  if (cachedResult != undefined) {
    logDebug("Fecth query from cache: " + JSON.stringify(request.jsonSearchQuery));
    response.send(cachedResult);
    return;
  }

  handleRequest("POST", "people/search", jsonSearchQuery).then(
    function (results) {
      var jsonRequestId = JSON.parse(results);
      request.queryId = jsonRequestId.id
      next();
    }).catch(function (err) {
      handleError(response, err);
    });
}

/**
 * Get the persons results by sending the query id
 * @param {*} request 
 * @param {*} response 
 */
function getPersons(request, response) {
  handleRequest("GET", "people", { "searchRequestId": request.queryId }).then(
    function (results) {
      //Save results in cache
      logDebug("Save query to cache: " + JSON.stringify(request.jsonSearchQuery));
      setCache(request.jsonSearchQuery, results);
      //Send response back to the client
      handleSuccess(response, results);
    }).catch(function (err) {
      if (err.statusCode == 102) {
        // A workaround since 102 is returning from the server often
        setTimeout(function () {
          getPersons(request, response)
        }, 200);
      } else {
        handleError(response, err);
      }
    });
}

/**
 * Handle request with promises (request-promises)
 * @param {*} method 
 * @param {*} path 
 * @param {*} query 
 */
function handleRequest(method, path, query) {
  return rp({
    headers: {
      "X-KLARNA-TOKEN": TOKEN,
      "accept": "application/json"
    },
    uri: YELLO_PAGE_API_URL + path,
    method: method,
    qs: query
  });
}

/**
 * Handle an error response from the yellow pages api
 * @param {*} res 
 * @param {*} result 
 */
function handleError(res, err) {
  logDebug(err);
  res.status(400).send("Oh uh, something went wrong");
}

/**
 * Get an item from cache 
 * @param {*} json 
 */
function getCache(json) {
  return resultsCache.get(hash.digest(json));
}

/**
 * Set item in cache
 * @param {*} jsonKey
 * @param {*} objectToCache 
 */
function setCache(jsonKey, objectToCache) {
  return resultsCache.set(hash.digest(jsonKey), objectToCache);
}

/**
 * Handle a success response from the yellow pages api
 * @param {*} res 
 * @param {*} result 
 */
function handleSuccess(res, result) {
  logDebug("Sending success response: " + result)
  res.setHeader('Content-Type', 'application/json');
  res.send(result);
}

/**
 * Check if value is age (0-125)
 * @param {*} value 
 */
function isAge(value) {
  return /^(0?[0-9]?[0-9]|1[01][0-9]|12[0-5])$/.test(value);
}

/**
 * Check if vaue is name
 * @param {*} value 
 */
function isName(value) {
  return /^[a-zA-ZäöåÄÖÅ.]+$/.test(value);
}

/**
 * Check if value is phone
 * @param {*} valus 
 */
function isPhone(value) {
  return /^\d{7,11}$/.test(value.replace(/(-|\+|\(|\))/g, ""))
}

/**
 * Build the search query for the yellow pages API
 * @param {*} query - the query from the request 
 */
function getJSONSearchQuery(query, pageNum) {
  var queryValues = query.split(" ");
  query = {};
  for (val in queryValues) {
    currentVal = queryValues[val];

    if (isAge(currentVal)) {
      query.age = currentVal;
    } else if (isName(currentVal)) {
      if (!query.name) {
        query.name = currentVal;
      } else {
        query.name += (" " + currentVal);
      }
    } else if (isPhone(currentVal)) {
      query.phone = currentVal;
    } /*else {
      // Depending on requirements, the search can fail if one value is invalid, currently it is not
      return {}
    }*/
    query.page = pageNum;
  }
  logDebug("query is: " + JSON.stringify(query));
  return query;
}

/**
 * Log to console when DEBUG == true
 * @param {*De} msg 
 */
function logDebug(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  logDebug("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal } : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));

var port = process.env.PORT || 3000
app.listen(port, function () {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
