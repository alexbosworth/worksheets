const {basename} = require('path');
const {join} = require('path');

const asyncAuto = require('async/auto');
const asyncMap = require('async/map');
const parse = require('csv-parse')
const {returnResult} = require('asyncjs-util');
const sanitize = require('sanitize-filename');
const {Workbook} = require('excel4node');

const cell = (ws, x, y) => ws.cell(x + 1, y + 1);
const dateRegex = /^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?$/i;
const {isArray} = Array;
const isNumeric = n => !isNaN(parseFloat(n)) && !isNaN(n);

/** Create an XSLX

  {
    csvs: [<CSV File Path String>]
    directory: <Directory To Create XSLX String>
    fs: {
      getFile: <Get Filesystem File Function> (path, cbk) => {}
      putFile: <Write File Contents Function> (path, contents, cbk) => {}
    }
    named: <File Name String>
  }
*/
module.exports = ({csvs, directory, fs, named}, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!isArray(csvs)) {
          return cbk([400, 'ExpectedArrayOfCsvsToCreateXlsx']);
        }

        if (!directory) {
          return cbk([400, 'ExpectedDirectoryNameToWriteXlsxFileTo']);
        }

        if (!fs) {
          return cbk([400, 'ExpectedFileSystemMethodsToCreateXlsx']);
        }

        if (!named) {
          return cbk([400, 'ExpectedNameForXlsxFileToCreate']);
        }

        if (sanitize(named) !== named) {
          return cbk([400, 'ExpectedValidFileNameForXlsxFile']);
        }

        return cbk();
      },

      // Get the CSV file data
      getCsvs: ['validate', ({}, cbk) => {
        return asyncMap(csvs, (path, cbk) => {
          const named = basename(path);

          return fs.getFile(path, (err, file) => {
            if (!!err) {
              return cbk([503, 'UnexpectedErrorGettingCsvFile', {err, named}]);
            }

            return cbk(null, {file, named});
          });
        },
        cbk);
      }],

      // Parse the CSV file data
      parseCsvs: ['getCsvs', ({getCsvs}, cbk) => {
        return asyncMap(getCsvs, (csv, cbk) => {
          const {named} = csv;

          return parse(csv.file.toString(), {}, (err, rows) => {
            if (!!err) {
              return cbk([503, 'UnexpectedErrorParsingCsv', {err, named}]);
            }

            return cbk(null, {named, rows});
          });
        },
        cbk);
      }],

      // Create the file blob
      file: ['parseCsvs', async ({parseCsvs}) => {
        const wb = new Workbook();

        parseCsvs.forEach(csv => {
          // Create a worksheet for the CSV
          const ws = wb.addWorksheet(csv.named);

          return csv.rows.forEach((row, x) => {
            return row.forEach((value, y) => {
              // Exit early when the cell value is date-like
              if (dateRegex.test(value)) {
                return cell(ws, x, y).date(value);
              }

              // Exit early when the cell value is numeric
              if (isNumeric(value)) {
                return cell(ws, x, y).number(parseFloat(value));
              }

              return cell(ws, x, y).string(value);
            });
          });
        });

        return await wb.writeToBuffer();
      }],

      // Write the file blob to disk
      write: ['file', ({file}, cbk) => {
        return fs.putFile(join(directory, `${named}.xlsx`), file, err => {
          if (!!err) {
            return cbk([503, 'FailedToWriteXlsxFileToDisk', {err}]);
          }

          return cbk();
        });
      }]
    },
    returnResult({reject, resolve}, cbk));
  });
};
