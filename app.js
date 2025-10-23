const fs = require('fs').promises;
const http = require('http');
const { program } = require('commander');
const { XMLBuilder } = require('fast-xml-parser');

program
  .requiredOption('-i, --input <path>', 'Path to input JSON file')
  .requiredOption('-H, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port');
  
program.parse(process.argv);
const opts = program.opts();
const INPUT = opts.input;
const HOST = opts.host;
const PORT = Number(opts.port);

const builder = new XMLBuilder({ ignoreAttributes: false, format: true });

(async () => {
  try {
    // Check file exists at start
    await fs.access(INPUT);
  } catch (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const raw = await fs.readFile(INPUT, 'utf-8');
      const parsed = JSON.parse(raw);

      // find passenger array
      let passengers = [];
      if (Array.isArray(parsed)) passengers = parsed;
      else if (Array.isArray(parsed.passengers)) passengers = parsed.passengers;
      else if (Array.isArray(parsed.data)) passengers = parsed.data;
      else {
        for (const k of Object.keys(parsed)) {
          if (Array.isArray(parsed[k])) { passengers = parsed[k]; break; }
        }
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const survivedQ = url.searchParams.get('survived');
      const ageQ = url.searchParams.get('age');

      if (survivedQ === 'true') {
        passengers = passengers.filter(p => {
          const s = p.Survived ?? p.survived ?? p.survival ?? p.SURVIVED;
          return s == 1 || s === true || s === 'true' || s === '1';
        });
      }

      const passengerNodes = passengers.map(p => {
        const name = p.Name ?? p.name ?? p.FullName ?? '';
        const ticket = p.Ticket ?? p.ticket ?? '';
        const node = { Name: name, Ticket: ticket };
        if (ageQ === 'true') node.Age = (p.Age ?? p.age ?? '');
        return node;
      });

      const xmlObj = { Passengers: { Passenger: passengerNodes } };
      const xml = builder.build(xmlObj);

      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(xml);
    } catch (err) {
      console.error(err);
      if (err.code === 'ENOENT') {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Cannot find input file');
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
})();
