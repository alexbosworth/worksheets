const {test} = require('tap');

const {createXlsx} = require('./../../xlsx');

const makeArgs = overrides => {
  const args = {
    csvs: ['path/to/csv'],
    directory: 'current/directory',
    fs: {
      getFile: (path, cbk) => cbk(
        null,
        Buffer.from(`"1","2","3"\n"${new Date().toISOString()}","b","c"`)
      ),
      putFile: (path, file, cbk) => cbk(),
    },
    named: 'sheet',
  };

  Object.keys(overrides).forEach(k => args[k] = overrides[k]);

  return args;
};

const tests = [
  {
    args: makeArgs({csvs: undefined}),
    description: 'An array of CSVs is required',
    error: [400, 'ExpectedArrayOfCsvsToCreateXlsx'],
  },
  {
    args: makeArgs({directory: undefined}),
    description: 'A directory is expected',
    error: [400, 'ExpectedDirectoryNameToWriteXlsxFileTo'],
  },
  {
    args: makeArgs({fs: undefined}),
    description: 'File system methods are expected',
    error: [400, 'ExpectedFileSystemMethodsToCreateXlsx'],
  },
  {
    args: makeArgs({named: undefined}),
    description: 'A file name is expected',
    error: [400, 'ExpectedNameForXlsxFileToCreate'],
  },
  {
    args: makeArgs({named: '\u0000'}),
    description: 'A valid file name is expected',
    error: [400, 'ExpectedValidFileNameForXlsxFile'],
  },
  {
    args: makeArgs({fs: {getFile: (path, cbk) => cbk('err')}}),
    description: 'Get file errors are returned',
    error: [503, 'UnexpectedErrorGettingCsvFile'],
  },
  {
    args: makeArgs({
      fs: {getFile: (path, cbk) => cbk(null, Buffer.from(',,\n,'))},
    }),
    description: 'CSV errors are returned',
    error: [503, 'UnexpectedErrorParsingCsv'],
  },
  {
    args: makeArgs({
      fs: {
        getFile: (path, cbk) => cbk(
          null,
          Buffer.from(`"1","2","3"\n"${new Date().toISOString()}","b","c"`)
        ),
        putFile: (path, file, cbk) => cbk('err'),
      },
    }),
    description: 'Put file errors are returned',
    error: [503, 'FailedToWriteXlsxFileToDisk'],
  },
  {
    args: makeArgs({}),
    description: 'An xlsx is created from CSVs',
  },
];

tests.forEach(({args, description, error, expected}) => {
  return test(description, async ({end, equal, rejects}) => {
    if (!!error) {
      await rejects(createXlsx(args), error, 'Got expected error');
    } else {
      await createXlsx(args);
    }

    return end();
  });
});
