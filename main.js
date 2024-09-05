var port = 8080;

const express = require("express");
const mysql = require("mysql");
const path = require("path");
const fs = require('fs')
const yaml = require('yaml')

function getDBConfig() {
  try {
    const file = fs.readFileSync('./config.yaml', 'utf8');
    const config = yaml.parse(file);
    return config.database;
  } catch (e) {
    console.error('Error reading or parsing config file:', e);
    return null;
  }
}

var con = mysql.createConnection(getDBConfig());

var veranstaltungen;

con.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/veranstaltungen", (req, res) => {
  con.query(
    "SELECT id, name, ort, beginn, ende FROM veranstaltungen;",
    function (err, results, fields) {
      if (err) {
        console.error("Error retrieving data from MySQL:", err);
        res.status(500).json({ error: "Error retrieving data from MySQL" });
      } else {
        res.json(results);
      }
    },
  );
});

app.get("/veranstaltung/:veranstaltung/wettkaempfe", (req, res) => {
  const veranstaltung = req.params.veranstaltung;
  var sql
  if (veranstaltung == 1001) {
  	sql = `
		SELECT distinct turnen_wettkaempfe.id, 
			name, 
			geschlecht, 
			jahrgangvon, jahrgangbis, 
			wettkampftypid, 
			aktivephase, 
			turnen_wettkampfphasen.status, 
			p1.wert AS bestesergebnisq1,
			false AS finaleabnull
		FROM (turnen_wettkaempfe, turnen_wettkampfphasen)
		LEFT JOIN turnen_wettkampfparameter AS p1 ON p1.wettkampfid=turnen_wettkaempfe.id AND p1.vorgabeid="bestesergebnisq1"
		LEFT JOIN turnen_wettkampfparameter AS p2 ON p2.wettkampfid=turnen_wettkaempfe.id AND p2.vorgabeid="finaleabnull"                
		WHERE turnen_wettkampfphasen.wettkampfid=turnen_wettkaempfe.id
		  AND (turnen_wettkaempfe.aktivephase=turnen_wettkampfphasen.position OR turnen_wettkaempfe.aktivephase IS NULL)
		  AND turnen_wettkaempfe.veranstaltungid=?
	`;
  } else {
  	sql = `
		SELECT distinct turnen_wettkaempfe.id, 
			name, 
			geschlecht, 
			jahrgangvon, jahrgangbis, 
			wettkampftypid, 
			aktivephase, 
			turnen_wettkampfphasen.status, 
			p1.wert AS bestesergebnisq1,
			p2.wert AS finaleabnull
		FROM (turnen_wettkaempfe, turnen_wettkampfphasen)
		LEFT JOIN turnen_wettkampfparameter AS p1 ON p1.wettkampfid=turnen_wettkaempfe.id AND p1.vorgabeid="bestesergebnisq1"
		LEFT JOIN turnen_wettkampfparameter AS p2 ON p2.wettkampfid=turnen_wettkaempfe.id AND p2.vorgabeid="finaleabnull"                
		WHERE turnen_wettkampfphasen.wettkampfid=turnen_wettkaempfe.id
		  AND (turnen_wettkaempfe.aktivephase=turnen_wettkampfphasen.position OR turnen_wettkaempfe.aktivephase IS NULL)
		  AND turnen_wettkaempfe.veranstaltungid=?
	`;
  }
  const inserts = [veranstaltung];
  const formattedSql = mysql.format(sql, inserts);

  con.query(formattedSql, (err, results) => {
    if (err) {
      console.error("Error retrieving data from MySQL:", err);
      res.status(500).json({ error: "Error retrieving data from MySQL" });
    } else {
      res.json(results);
    }
  });
});

app.get(
  "/veranstaltung/:veranstaltung/wettkampf/:wettkampf/turner",
  (req, res) => {
    const veranstaltung = req.params.veranstaltung;
    const wettkampf = req.params.wettkampf;
    const sql = `
		SELECT turnen_turner.id, vereine.name AS vereinsname, vereine.ort, sportler.name, sportler.vorname
		FROM turnen_turner, teilnehmer, sportler, vereine, turnen_wettkaempfe, veranstaltungen
		WHERE turnen_turner.teilnehmerid = teilnehmer.id 
		AND teilnehmer.sportlerid = sportler.id
		AND sportler.vereinid = vereine.id
		AND turnen_turner.wettkampfid=turnen_wettkaempfe.id
		AND turnen_wettkaempfe.veranstaltungid=veranstaltungen.id
		AND veranstaltungen.id=?
		AND turnen_wettkaempfe.id=?
	`;

    const inserts = [veranstaltung, wettkampf];
    const formattedSql = mysql.format(sql, inserts);

    con.query(formattedSql, (err, results) => {
      if (err) {
        console.error("Error retrieving data from MySQL:", err);
        res.status(500).json({ error: "Error retrieving data from MySQL" });
      } else {
        res.json(results);
      }
    });
  },
);

app.get(
  "/veranstaltung/:veranstaltung/wettkampf/:wettkampf/uebungen",
  (req, res) => {
    const veranstaltung = req.params.veranstaltung;
    const wettkampf = req.params.wettkampf;
    var sql = `
	SELECT turnen_startplaetze.phase, sportler.vorname, 
		sportler.name, 
		vereine.name AS vereinsname, 
		turnen_startplaetze.gruppe, turnen_startplaetze.folge, 
		ue1.ergebnis AS erg1, ue1.id AS ue1_id,
		ue2.ergebnis AS erg2, ue2.id AS ue2_id,
		mannschaft.name AS mannschaft
	FROM (turnen_turner, vereine, turnen_startplaetze, veranstaltungen, turnen_wettkaempfe, teilnehmer, sportler)
	LEFT JOIN turnen_uebungen ue1 
			   ON turnen_wettkaempfe.id=ue1.wettkampfid AND ue1.turnerid=turnen_turner.id AND ue1.durchgangposition=1 AND ue1.phaseposition=turnen_startplaetze.phase
	LEFT JOIN turnen_uebungen ue2 
			   ON turnen_wettkaempfe.id=ue2.wettkampfid AND ue2.turnerid=turnen_turner.id AND ue2.durchgangposition=2 AND ue2.phaseposition=turnen_startplaetze.phase
	LEFT JOIN turnen_mannschaften mannschaft
			   ON turnen_turner.mannschaftid=mannschaft.id
	WHERE turnen_startplaetze.wettkampfid=turnen_wettkaempfe.id
  	  AND sportler.vereinid=vereine.id
  	  AND turnen_turner.teilnehmerid=teilnehmer.id
  	  AND turnen_turner.id=turnen_startplaetze.turnerid
	  AND turnen_wettkaempfe.veranstaltungid=veranstaltungen.id
	  AND teilnehmer.veranstaltungid=veranstaltungen.id
	  AND teilnehmer.sportlerid=sportler.id
	  AND turnen_startplaetze.durchgang=1
	  AND veranstaltungen.id=?
	  AND turnen_wettkaempfe.id=?
	ORDER BY turnen_startplaetze.phase, turnen_startplaetze.gruppe, turnen_startplaetze.folge ASC 
	`;

    const inserts = [veranstaltung, wettkampf];
    var formattedSql = mysql.format(sql, inserts);

    con.query(formattedSql, (err, results) => {
      if (err) {
        console.error("Error retrieving data from MySQL:", err);
        res.status(500).json({ error: "Error retrieving data from MySQL" });
      } else {
        sql = `
		SELECT
		  turnen_uebungenwerte.*
		FROM
		  turnen_uebungenwerte, turnen_uebungen, turnen_wettkaempfe, veranstaltungen
		WHERE
		  turnen_uebungenwerte.uebungid          = turnen_uebungen.id
		  AND turnen_uebungen.wettkampfid        = turnen_wettkaempfe.id
		  AND turnen_wettkaempfe.veranstaltungid = veranstaltungen.id
		  AND veranstaltungen.id    = ?
		  AND turnen_wettkaempfe.id = ?
		ORDER BY uebungid
	    `;
        formattedSql = mysql.format(sql, inserts);
        con.query(formattedSql, (err, details) => {
          if (err) {
            console.error("Error retrieving data from MySQL:", err);
            res.status(500).json({ error: "Error retrieving data from MySQL" });
          } else {
            var data = {};
            details.forEach((e) => {
              if (data[e.uebungid] === undefined) {
                data[e.uebungid] = {};
              }
              if (e.feldid.substr(0,5) != "abzug") {
                data[e.uebungid][e.feldid] = e.wert;
              }
            });

            results.forEach((e) => {
              e["ue1"] = e["ue1_id"] !== null ? data[e.ue1_id] : {};
              e["ue2"] = e["ue2_id"] !== null ? data[e.ue2_id] : {};
            });
            res.json(results);
          }
        });
      }
    });
  },
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
