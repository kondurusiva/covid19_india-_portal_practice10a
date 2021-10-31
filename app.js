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

initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertDBStates = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};

const convertDBDistricts = (eachDistrict) => {
  return {
    districtId: eachDistrict.district_id,
    districtName: eachDistrict.district_name,
    stateId: eachDistrict.state_id,
    cases: eachDistrict.cases,
    cured: eachDistrict.cured,
    active: eachDistrict.active,
    deaths: eachDistrict.deaths,
  };
};

const AuthenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
        *
    FROM
        user
    WHERE
        username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API2
app.get("/states/", AuthenticateToken, async (request, response) => {
  const statesQuery = `
    SELECT
    *
    FROM
    state;`;
  const aboutState = await db.all(statesQuery);
  response.send(aboutState.map((eachState) => convertDBStates(eachState)));
});

//API3
app.get("/states/:stateId/", AuthenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const IdQuery = `
  SELECT
    *
  FROM
    state
  WHERE
    state_id='${stateId}'`;

  const stateIdQuery = await db.get(IdQuery);
  response.send(convertDBStates(stateIdQuery));
});

//API4
app.post("/districts/", AuthenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertQuery = `
  INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(insertQuery);
  response.send("District Successfully Added");
});

//API5
app.get(
  "/districts/:districtId/",
  AuthenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
  SELECT
    *
  FROM
    district
  WHERE
    district_id=${districtId};`;
    const idQuery = await db.get(districtQuery);
    response.send(convertDBDistricts(idQuery));
  }
);

//API6
app.delete(
  "/districts/:districtId/",
  AuthenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM 
        district 
    WHERE 
        district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API7
app.put(
  "/districts/:districtId/",
  AuthenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
  UPDATE 
    district 
  SET 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API8
app.get(
  "/states/:stateId/stats/",
  AuthenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const joinQuery = `
    SELECT 
        sum(cases) AS totalCases,
        sum(cured) AS totalCured,
        sum(active) AS totalActive,
        sum(deaths) AS totalDeaths 
    FROM 
        state natural join district
    WHERE 
        state_id=${stateId};`;
    const dbUser = await db.get(joinQuery);
    response.send({
      totalCases: dbUser["totalCases"],
      totalCured: dbUser["totalCured"],
      totalActive: dbUser["totalActive"],
      totalDeaths: dbUser["totalDeaths"],
    });
  }
);
module.exports = app;
