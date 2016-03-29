// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var events = require('events');
var util = require('util');

function servoController (tessel, low, high) {
  /**
  Constructor

  Args
    hardware
      Tessel pwm pin to use
    low
      Minimum PWM value (should be 0-1.0 for best results)
    high
      Maximum PWM value (should be low-1.0 for best results)
  */
  this.tessel = tessel;
  this.pwms = this.tessel.port.A.pwm.concat(this.tessel.port.B.pwm);
  //  Set default high and low duty cycles for the module
  this.low = low || 0.05;
  if (low === 0) {
    this.low = 0;
  }
  this.high = high || 0.12;

  //  Store PWM settings for each servo individually
  this.servoConfigurations = {};
}

util.inherits(servoController, events.EventEmitter);


// Sets the PWM max and min for the specified servo
servoController.prototype.configure = function (index, low, high, callback) {
  /**
  Many hobby servos, motor speed controllers, etc. expect a nominal 20 ms
  period and map duty cycles (% time the signal is high for a given period) of
  10% and 20% to minimum and maximum positions, respectively. The protocol is
  not particularly strict, though, so it is not uncommon for servos to respond
  to duty cycles outside the 10%-20% range. This command allows each servo's
  minimum and maximum PWM values to be controlled individually.

  Args
    index
      Servo to configure
    low
      PWM lower bound (value for move(index, 0))
    high
      PWM upper bound (value for move(index, 1))
    callback
      Callback
  */
  if (low >= high) {
    var err = new RangeError('Minimum PWM must be smaller than maximum PWM.');
    if (callback) {
      callback(err);
    }
    return err;
  }

  this.servoConfigurations[index] = [low, high];
  if (callback) {
    callback(null);
  }
};

// Get the PWM max and min for the specified servo
servoController.prototype.getConfiguration = function (index, callback) {
  /**
  Args
    index
      index of servo configuration to read.
    callback
      Callback

  Callback parameters
    err
      null
    config
      An array with the following contents:
        0 - low
          PWM lower bound (PWM value for move(index, 0))
        1 - high
          PWM upper bound (PWM value for move(index, 1))

  Returns
    config
      as described above
  */
  if (!this.servoConfigurations[index]) {
    if (callback) {
      callback(new Error('Specified servo channel has not been configured'), null);
    }
    throw new Error('Specified servo channel has not been configured');
  } else {
    if (callback) {
      callback(null, this.servoConfigurations[index]);
    }
    return this.servoConfigurations[index];
  }
};

// Sets the position of the specified servo
servoController.prototype.move = function (index, val, callback) {
  /**
  Args
    index
      Index of the servo. NOTE: servos are 1-indexed
    val
      Position to which the the servo is to move. 0-1 of its full scale.
    callback
      Callback
  */
  if (index < 0 || index > 3) {
    var err = new RangeError('Servo index can be between 0-3.');
    if (callback) {
      callback(err);
    }
    return err;
  }

  if (val < 0 || val > 1) {
    var err = new RangeError('Invalid position. Value must be between 0 and 1');
    if (callback) {
      callback(err);
    }
    return err;
  }

  //  If unconfigured, use the controller's default values
  if (!this.servoConfigurations[index]) {
    this.configure(index, this.low, this.high, null);
  }

  var low = this.servoConfigurations[index][0];
  var high = this.servoConfigurations[index][1];

  this.setDutyCycle(index, (val * (high - low)) + low, callback);
};

// Sets the duty cycle for the specified servo
servoController.prototype.setDutyCycle = function (index, on, callback) {
  /**
  Args
    index
      Servo index to set
    on
      Duty cycle (0-1) for the specified servo
    callback
      Callback
  */

  if (index < 0 || index > 3) {
    var err = new RangeError('Servos can be between 0-3.');
    if (callback) {
      callback(err);
    }
    return err;
  }

  if (on < 0 || on > 1) {
    var err = new RangeError('Invalid duty cycle. Value must be between 0 and 1');
    if (callback) {
      callback(err);
    }
    return err;
  }


  this.pwms[index].pwmDutyCycle(on);
};

// Sets the PWM frequency in Hz for the PCA9685 chip
servoController.prototype.setFrequency = function (freq, callback) {
  this.tessel.pwmFrequency(freq, callback);
};

function use (tessel, low, high, callback) {
  /**
  Connect to the Servo Module

  Args
    tessel
      Tessel board to use
    low
      Minimum duty cycle (0-1.0)
    high
      Maximum duty cycle (should be between low and 1.0 for best results)
    callback
      Callback
  */
  if (typeof low == 'function') {
    callback = low;
    low = null;
  }

  var servos = new servoController(tessel, low, high);
  servos.setFrequency(50, function (err) {
    if (!err) {
      setImmediate(function () {
        servos.emit('ready');
      });
      if (callback) {
        callback(null, servos);
      }
    } else {
      setImmediate(function () {
        servos.emit('error', err);
      });
      if (callback) {
        callback(err);
      }
    }
  });
  return servos;
}

exports.use = use;
exports.servoController = servoController;
