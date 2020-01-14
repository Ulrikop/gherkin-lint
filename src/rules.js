// Operations on rules

var fs = require('fs');
var path = require('path');

var DISABLE_TAG_REGEX = /@lint-disable(.*)/;

function getAllRules(additionalRulesDirs) {
  var rules = {};
  var rulesDirs = [path.join(__dirname, 'rules')].concat(additionalRulesDirs || []);
  rulesDirs.forEach(function(rulesDir) {
    rulesDir = path.resolve(rulesDir);
    fs.readdirSync(rulesDir).forEach(function(file) {
      var rule = require(path.join(rulesDir, file));
      rules[rule.name] = rule;
    });
  });
  return rules;
}

function getRule(rule, additionalRulesDirs) {
  return getAllRules(additionalRulesDirs)[rule];
}

function doesRuleExist(rule, additionalRulesDirs) {
  return getRule(rule, additionalRulesDirs) !== undefined;
}

function isRuleEnabled(ruleConfig) {
  if (Array.isArray(ruleConfig)) {
    return ruleConfig[0] === 'on';
  }
  return ruleConfig === 'on';
}

function runAllEnabledRules(feature, file, configuration, additionalRulesDirs) {
  var errors = [];
  var rules = getAllRules(additionalRulesDirs);
  Object.keys(rules).forEach(function(ruleName) {
    var rule = rules[ruleName];
    if (isRuleEnabled(configuration[rule.name]) && isRuleEnabledAtBlock(rule.name, feature)) {
      var ruleConfig = Array.isArray(configuration[rule.name]) ? configuration[rule.name][1] : {};
      var error = rule.run(filterEnabledBlocks(rule.name, feature), file, ruleConfig);
      if (error) {
        errors = errors.concat(error);
      }
    }
  });
  return errors;
}

function filterEnabledBlocks(rule, feature) {
  if (!feature.children) {
    return feature;
  }

  // the feature is copied so that the original feature is not changed
  // but it is not deeply copied because only the children will be changed here
  var filteredFeature = Object.assign({}, feature);

  filteredFeature.children = filteredFeature.children.filter(isRuleEnabledAtBlock.bind(undefined, rule));
  filteredFeature.children = filteredFeature.children.map(filterDisabledExamples.bind(undefined, rule));

  return filteredFeature;
}

function filterDisabledExamples(rule, child) {
  if (child.type !== 'ScenarioOutline') {
    return child;
  }

  const filteredScenario = Object.assign({}, child);

  filteredScenario.examples = filteredScenario.examples.filter(isRuleEnabledAtBlock.bind(undefined, rule));

  return filteredScenario;
}

function isRuleEnabledAtBlock(rule, block) {
  if (!block.tags) {
    return true;
  }

  return !block.tags.some(isRuleDisableTag.bind(undefined, rule));
}

function isRuleDisableTag(rule, tag) {
  var match = DISABLE_TAG_REGEX.exec(tag.name);

  if (!match) {
    return false;
  }

  var disabledRules = match[1];

  if (!disabledRules) {
    return true; // if no rule is configured, all rules are disabled
  }

  disabledRules = disabledRules.replace(/^=+/, '');

  // multiple disabled rules can be concatenated with a comma
  return disabledRules.split(',').some(function(disabledRule) {
    return disabledRule.trim() === rule;
  });
}

module.exports = {
  doesRuleExist: doesRuleExist,
  isRuleEnabled: isRuleEnabled,
  runAllEnabledRules: runAllEnabledRules,
  getRule: getRule,
  getAllRules: getAllRules,
};
