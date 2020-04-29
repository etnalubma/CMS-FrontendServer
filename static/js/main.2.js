"use strict";

function getConfigInterval() {
  const storedConfig = localStorage.getItem(SIMULATION_ITER_CONFIG_KEY);
  if (storedConfig != null) {
    return JSON.parse(storedConfig);
  }
  return defaultIterConfig;
}

const app = new Vue({
  el: "#app",
  data: function () {
    return {
      SIM_STATE: SIM_STATE, // Declare enum variable so vue can access it on the template

      simulationState: SIM_STATE.DONE,
      simulationModel: localStorage.getItem(SIMULATION_MODEL_KEY) || defaultSimulationModel,
      simulationConfig: localStorage.getItem(SIMULATION_CONFIG_KEY) || defaultConfigText,
      errorMsg: null,
      statusMsg: null,

      configInterval: getConfigInterval(),

      currentSimulation: null,
      pendingChanges: true,

      // We're using the bus pattern here, but it would be better if we can do something like
      // a service.
      simCancel: false,
      autoRenderVideo: false,
    };
  },
  computed: {
    modelVariables: function () {
      return _extractModelVariables(this.simulationModel);
    },
  },
  watch: {
    simulationModel: function (val) {
      this.pendingChanges = true;
      localStorage.setItem(SIMULATION_MODEL_KEY, val);
    },
    simulationConfig: function (val) {
      this.pendingChanges = true;
      localStorage.setItem(SIMULATION_CONFIG_KEY, val);
    },
    configInterval: {
      handler(val) {
        this.pendingChanges = true;
        localStorage.setItem(SIMULATION_ITER_CONFIG_KEY, JSON.stringify(val));
      },
      deep: true,
    },
  },

  methods: {
    buildSimulation(configInterval) {
      this.setError("");
      this.configInterval = configInterval;

      // Make all objects given to the simulation inmutable, as they're all bound to vue changes.
      this.currentSimulation = {
        model: this.simulationModel,
        config: this.simulationConfig,
        intervalConfig: Vue.util.extend({}, configInterval),
      };
      setTimeout(() => {
        this.pendingChanges = false;
      }, 0); // Wrap in timeout, otherwise Vue doesn't take this change into account
    },
    stopSimulation: function () {
      this.simCancel = true;
    },

    setError: function (message) {
      if (message) {
        this.errorMsg = "[ERROR]: " + message;
      } else {
        this.errorMsg = null;
      }

      this.statusMsg = null;
    },
    setStatus: function (message) {
      this.errorMsg = null;
      this.statusMsg = message;
    },

    reset: function (event) {
      this.simulationModel = defaultSimulationModel;
      this.simulationConfig = defaultConfigText;
    },

    handleError: function (error) {
      console.error(error);
      this.setError(error.message);
    },
    handleSubmit: function (values) {
      if (this.simulationState === SIM_STATE.INPROGRESS) {
        this.stopSimulation();
      } else {
        this.buildSimulation(values);
      }
    },
    handleSimStart: function () {
      this.simulationState = SIM_STATE.INPROGRESS;
    },
    handleSimError: function (err) {
      this.simulationState = SIM_STATE.ERROR;

      if (err.status === 500) {
        this.setError(`A server error ocurred while running the simulation`);
      } else if (err.status === 400) {
        err.text().then((msg) => {
          if (msg && msg.indexOf("The given key was not present in the dictionary.") !== -1) {
            // Most probably we encountered a variable that's not defined
            let errorMsg = "There is an error on the model definition";

            const variable = msg.match(/'\w+'/); // Naive regex to match possible undefined variable
            errorMsg += `\nCould it be that ${variable[0]} is not defined?`;
            this.setError(errorMsg);
          } else {
            this.setError(`There was an error while running the simulation`);
          }
        });
      } else {
        this.setError(`There was an error while running the simulation`);
      }
    },
    handleSimDone: function () {
      this.simulationState = SIM_STATE.DONE;
    },
    handleSimCancel: function () {
      this.simulationState = SIM_STATE.CANCELED;
      this.simCancel = false;
    },
  },
});
