define([
    './Model',
    'lodash'
], function (
    Model,
    _
) {

   /**
    * YAxis model
     *
    * TODO: docstrings.
    *
    * has the following Model properties:
    *
    * `autoscale`: boolean, whether or not to autoscale.
    * `autoscalePadding`: float, percent of padding to display in plots.
    * `displayRange`: the current display range for the x Axis.
    * `format`: the formatter for the axis.
    * `frozen`: boolean, if true, displayRange will not be updated automatically.
    *           Used to temporarily disable automatic updates during user interaction.
    * `label`: label to display on axis.
    * `stats`: Min and Max Values of data, automatically updated by observing
    *          plot series.
    * `values`: for enumerated types, an array of possible display values.
    * `range`: the user-configured range to use for display, when autoscale is
    *         disabled.
    *
    */
    var YAxisModel = Model.extend({
        initialize: function (options) {
            this.plot = options.plot;
            this.listenTo(this, 'change:stats', this.calculateAutoscaleExtents, this);
            this.listenTo(this, 'change:autoscale', this.toggleAutoscale, this);
            this.listenTo(this, 'change:autoscalePadding', this.updatePadding, this);
            this.listenTo(this, 'change:frozen', this.toggleFreeze, this);
            this.listenTo(this, 'change:range', this.updateDisplayRange, this);
            this.updateDisplayRange(this.get('range'));
        },
        listenToSeriesCollection: function (seriesCollection) {
            this.seriesCollection = seriesCollection;
            this.listenTo(this.seriesCollection, 'add', function (series) {
                this.trackSeries(series);
                this.updateFromSeries(this.seriesCollection);
            }, this);
            this.listenTo(this.seriesCollection, 'remove', function (series) {
                this.untrackSeries(series);
                this.updateFromSeries(this.seriesCollection);
            }, this);
            this.seriesCollection.forEach(this.trackSeries, this);
            this.updateFromSeries(this.seriesCollection);
        },
        updateDisplayRange: function (range) {
            if (!this.get('autoscale')) {
                this.set('displayRange', range);
            }
        },
        toggleFreeze: function (frozen) {
            if (!frozen) {
                this.toggleAutoscale(this.get('autoscale'));
            }
        },
        applyPadding: function (range) {
            var padding = Math.abs(range.max - range.min) * this.get('autoscalePadding');
            if (padding === 0) {
                padding = 1;
            }
            return {
                min: range.min - padding,
                max: range.max + padding,
            };
        },
        updatePadding: function (newPadding) {
            if (this.get('autoscale') && !this.get('frozen') && this.has('stats')) {
                this.set('displayRange', this.applyPadding(this.get('stats')));
            }
        },
        calculateAutoscaleExtents: function (newStats) {
            if (this.get('autoscale') && !this.get('frozen')) {
                if (!newStats) {
                    this.unset('displayRange');
                } else {
                    this.set('displayRange', this.applyPadding(newStats));
                }
            }
        },
        updateStats: function (seriesStats) {
            if (!this.has('stats')) {
                this.set('stats', {
                    min: seriesStats.minValue,
                    max: seriesStats.maxValue
                });
                return;
            }
            var stats = this.get('stats');
            var changed = false;
            if (stats.min > seriesStats.minValue) {
                changed = true;
                stats.min = seriesStats.minValue;
            }
            if (stats.max < seriesStats.maxValue) {
                changed = true;
                stats.max = seriesStats.maxValue;
            }
            if (changed) {
                this.set('stats', {
                    min: stats.min,
                    max: stats.max
                });
            }
        },
        resetStats: function () {
            this.unset('stats');
            this.seriesCollection.forEach(function (series) {
                if (series.has('stats')) {
                    this.updateStats(series.get('stats'));
                }
            }, this);
        },
        trackSeries: function (series) {
            this.listenTo(series, 'change:stats', function (seriesStats) {
                if (!seriesStats) {
                    this.resetStats();
                } else {
                    this.updateStats(seriesStats);
                }
            }, this);
        },
        untrackSeries: function (series) {
            this.stopListening(series);
            this.resetStats();
        },
        toggleAutoscale: function (autoscale) {
            if (autoscale) {
                this.set('displayRange', this.applyPadding(this.get('stats')));
            } else {
                this.set('displayRange', this.get('range'));
            }
        },
        /**
         * Update yAxis format, values, and label from known series.
         */
        updateFromSeries: function (series) {
            var sampleSeries = series.first();
            if (!sampleSeries) {
                return;
            }

            var yKey = sampleSeries.get('yKey')
            var yMetadata = sampleSeries.metadata.value(yKey);
            var yFormat = sampleSeries.formats[yKey];
            this.set('format', yFormat.format.bind(yFormat));
            this.set('values', yMetadata.values);

            var plotModel = this.plot.get('domainObject');
            var label = _.get(plotModel, 'configuration.xAxis.label');
            if (!label) {
                var labelUnits = series.map(function (s) {
                    return s.metadata.value(s.get('yKey')).units;
                }).reduce(function (a, b) {
                    if (a === undefined) {
                        return b;
                    }
                    if (a === b) {
                        return a;
                    }
                    return '';
                }, undefined);
                if (labelUnits) {
                    this.set('label', labelUnits);
                    return;
                }
                var labelName = series.map(function (s) {
                    return s.metadata.value(s.get('yKey')).name;
                }).reduce(function (a, b) {
                    if (a === undefined) {
                        return b;
                    }
                    if (a === b) {
                        return a;
                    }
                    return '';
                }, undefined);
                this.set('label', labelName);
            }
        },
        defaults: function (options) {
            return {
                frozen: false,
                autoscale: true,
                autoscalePadding: 0.1
            };
        }
    });

    return YAxisModel;

});