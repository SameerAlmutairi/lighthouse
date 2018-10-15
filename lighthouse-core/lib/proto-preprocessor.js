/**
 * @license Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const fs = require('fs');

/**
 * @fileoverview Helper functions to transform an LHR into a proto-ready LHR.
 *
 * FIXME: This file is 100% technical debt.  Our eventual goal is for the
 * roundtrip JSON to match the Golden LHR 1:1.
 */

/**
  * @param {string} result
  */
function processForProto(result) {
  /** @type {LH.Result} */
  const reportJson = JSON.parse(result);

  // Clean up actions that require 'audits' to exist
  if ('audits' in reportJson) {
    Object.keys(reportJson.audits).forEach(auditName => {
      const audit = reportJson.audits[auditName];

      // Rewrite the 'not-applicable' scoreDisplayMode to 'not_applicable'. #6201
      if ('scoreDisplayMode' in audit) {
        if (audit.scoreDisplayMode === 'not-applicable') {
          // @ts-ignore Breaking the LH.Result type
          audit.scoreDisplayMode = 'not_applicable';
        }
      }
      // Drop raw values. #6199
      if ('rawValue' in audit) {
        delete audit.rawValue;
      }
      // Normalize displayValue to always be a string, not an array. #6200

      if (Array.isArray(audit.displayValue)) {
        /** @type {Array<any>}*/
        const values = [];
        audit.displayValue.forEach(item => {
          values.push(item);
        });
        audit.displayValue = values.join(' | ');
      }
    });
  }

  // Drop the i18n icuMessagePaths. Painful in proto, and low priority to expose currently.
  if ('i18n' in reportJson && 'icuMessagePaths' in reportJson.i18n) {
    delete reportJson.i18n.icuMessagePaths;
  }

  // Remove any found empty strings, as they are dropped after round-tripping anyway
  /**
   * @param {any} obj
   */
  function removeStrings(obj) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string' && obj[key] === '') {
          delete obj[key];
        } else if (typeof obj[key] === 'object' || Array.isArray(obj[key])) {
          removeStrings(obj[key]);
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (typeof item === 'object' || Array.isArray(item)) {
          removeStrings(item);
        }
      });
    }
  }

  removeStrings(reportJson);

  return JSON.stringify(reportJson);
}

// @ts-ignore claims always false, but this checks if cli or module
if (require.main === module) {
  // read in the argv for the input & output
  const args = process.argv.slice(2);
  let input;
  let output;

  if (args.length) {
    input = args.find(flag => flag.startsWith('--in'));
    output = args.find(flag => flag.startsWith('--out'));
  }

  if (input && output) {
    // process the file
    const report = processForProto(fs.readFileSync(input.replace('--in=', ''), 'utf-8'));
    // write to output from argv
    fs.writeFileSync(output.replace('--out=', ''), report, 'utf-8');
  }
} else {
  module.exports = {
    processForProto,
  };
}
