const convertDbObjectToResponseObject = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};

const convertObjResToDistrictRes = (eachObj) => {
  return {
    districtId: eachObj.district_id,
    districtName: eachObj.district_name,
    stateId: eachObj.state_id,
    cases: eachObj.cases,
    cured: eachObj.cured,
    active: eachObj.active,
    deaths: eachObj.deaths,
  };
};
const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "chandu");
      const responseToken = { jwtToken: jwtToken };
      response.send(responseToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//Authentication with Token
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "chandu", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//API 2
app.get("/states/", authentication, async (request, response) => {
  const getstateQuery = `
    SELECT *
    FROM 
    state;`;
  const stateArray = await db.all(getstateQuery);
  response.send(
    stateArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});
//API 3
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetails = `
    SELECT *
    FROM 
    state 
    WHERE 
    state_id=${stateId};`;
  const stateDetails = await db.get(getStateDetails);
  response.send(convertDbObjectToResponseObject(stateDetails));
});
//API 4
app.post("/districts/", authentication, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const AddistrictQuery = `
  INSERT INTO
  district( district_name,
    state_id,
    cases,
    cured,
    active,
    deaths)
  VALUES 
  (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
  );`;
  const dbResponse = await db.run(AddistrictQuery);
  response.send("District Successfully Added");
});
//API 5
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getdistrictDetails = `
    SELECT
    *
    FROM 
    district 
    WHERE 
    district_id=${districtId};`;
    const districtDetails = await db.get(getdistrictDetails);
    response.send(convertObjResToDistrictRes(districtDetails));
  }
);
//API 6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
DELETE FROM 
district 
WHERE 
district_id=${districtId};`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);
//API 7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictDetails = `
  UPDATE 
  district 
  SET 
  district_name='${districtName}',
  state_id=${stateId} ,
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  WHERE
  district_id=${districtId};`;
    await db.run(updateDistrictDetails);
    response.send("District Details Updated");
  }
);
//API 8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getstateStats = `
SELECT
SUM(cases),
SUM(cured),
SUM(active),
SUM(deaths)
FROM 
 district
WHERE 
state_id=${stateId};`;
    const stats = await db.get(getstateStats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
