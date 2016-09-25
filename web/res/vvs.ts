(function() {
    'use strict';

    class VVS {
        requestUrl: 'vvs.php'

        request(data) {
            return $.ajax( {
                url: this.requestUrl,
                dataType: "json",
                data: data
            });
        }

        setRequestUrl(url) {
            this.requestUrl = url;
        }

        stationSchedule(station, options) {

            // default settings
            var settings = $.extend({
                maxEntries: 20,
                minDeparture: 3,
                maxDeparture: 120,
                filterDirection: false,
            }, options);

            var request = this.request({
                type: "departures",
                station: station
            });

            const promise = new Promise((resolve, reject) => {
                request.done(data => {
                    var currentdate = new Date();

                    var ret = [];
                    $.each(data, (index,line) => {
                        var departureTime = line.departureTime;
                        //delete line.departureTime;

                        line.departure = this.calculateDepatureTime(departureTime, currentdate);
                        line.numberType = this.transformLineNumberToType(line.number);
                        line.delayType = this.transformDelayToType(line.delay);
                        line.delaySign = Math.sign(line.delay);
                        line.delayAbs  = Math.abs(line.delay);

                        ret.push(line);
                    });

                    // filter by departure time
                    ret = ret.filter((value) => {
                        return (value.departure >= settings.minDeparture && value.departure <= settings.maxDeparture)
                    });

                    // filter by direction
                    if (settings.filterDirection) {
                        ret = ret.filter((value) => {
                            return value.direction.match(settings.filterDirection);
                        });
                    }

                    // filter by line
                    if (settings.filterLine) {
                        ret = ret.filter((value) => {
                            return value.number.match(settings.filterLine);
                        });
                    }

                    // filter by max entires
                    if (settings.maxEntries) {
                        ret.splice(settings.maxEntries);
                    }

                    resolve(ret);
                });

                // ajax error
                request.error((jqXHR, textStatus, errorThrown) => {
                    reject(`${textStatus}: ${errorThrown}`);
                });
            });

            return promise;
        }

        calculateDepatureTime(departure, currentdate) {
            var ret = 0;

            ret = (parseInt(departure.year)*365*24*60)-(parseInt(currentdate.getFullYear())*365*24*60);  //Get the year
            ret = ret + (parseInt(departure.month)*12*24*60)-((parseInt(currentdate.getMonth())+1)*12*24*60);  //Get the month
            ret = ret + (parseInt(departure.day)*24*60)-(parseInt(currentdate.getDate())*24*60);  //Get the day
            ret = ret + ((parseInt(departure.hour))*60)-(parseInt(currentdate.getHours())*60);  //Get the hour
            ret = ret + parseInt(departure.minute)-parseInt(currentdate.getMinutes());  //Get the minute

            return ret;
        }

        transformLineNumberToType(lineNumber) {
            var ret = "";

            // check if Bus
            if (!isNaN(Number(lineNumber))) {
                ret = "B";
            } else {
                ret = lineNumber.charAt(0);
            }

            return ret;
        }

        transformDelayToType(delay) {
            var ret = '';
            switch(Math.sign(delay)) {
                case -1:
                    ret = "-";
                    break;

                case 1:
                    ret = "+";
                    break;
            }

            return ret;
        }
    }


    $.fn.vvsStation = function(options) {
        this.each(function(index, el) {
            var $this = $(el);
            var vvs = new VVS();

            // default settings
            var settings = $.extend({
                // These are the defaults.
                color: "#556b2f",
                backgroundColor: "white",
                updateTime:  90 * 1000,
                updateTimeRandom: 5 * 1000,
                firstUpdateTimeRandom: 2.5 * 1000,
                station: false,
                maxEntries: 20,
                minDeparture: 3,
                maxDeparture: 120,
                loadingIndicator: '',
                filterDirection: false,
                filterLine: false,
                requestUrl: 'vvs.php',
                translation: {
                    noData: 'No station info available'
                }
            }, $this.data(), options);

            if (settings.filterDirection) settings.filterDirection = new RegExp(settings.filterDirection);
            if (settings.filterLine)      settings.filterLine = new RegExp(settings.filterLine);

            if (!settings.station) {
                console.log('VVS station not set');
                return;
            }

            if (settings.requestUrl) {
                vvs.setRequestUrl(settings.requestUrl);
            }

            var addLoadingIndicator = () => {
                if (!$this.find('.spinner-content').length) {
                    $this.append('<div class="spinner-content">' + settings.loadingIndicator + '</div>');
                }
            }

            var updateSchedule = () => {
                addLoadingIndicator();

                var schedule = vvs.stationSchedule(settings.station, settings);
                schedule.then(data => {
                    $this.html('');

                    var tableEl = false;

                    if(data.length) {
                        $.each(data, (index, line) => {
                            if (index === 0) {
                                $this.append(`<h3>${line.stopName}</h3>`);
                                tableEl = $this.append('<table class="table table-condensed"><tbody></tbody></table>').find('table tbody');
                            }

                            var rowClasses = [];

                            switch (line.delaySign) {
                                case 1:
                                    rowClasses.push('danger');
                                    break;

                                case -1:
                                    rowClasses.push('warning');
                                    break;
                            }

                            var rowClass = rowClasses.join(' ');

                            var template = `
                            <tr class="${rowClass}">
                                <td class="line"></td>
                                <td class="direction">
                                    <div class="line-symbol" data-line="${line.numberType}" data-line="${line.number}">${line.number}</div>
                                    <div class="direction">${line.direction}</div>
                                </td>
                                <td class="departure">
                                    <div class="departure">${line.departure}</div>
                                </td>
                                <td class="delay">
                                    <div class="badge delay" data-delay="${line.delayType}">${line.delayAbs}</div>
                                </td>
                            </tr>
                        `;
                            tableEl.append(template);
                        });
                    } else {
                        $this.append(`<div class="alert alert-warning" role="alert">${settings.translation.noData} (${settings.station})</div>`);
                    }
                });

                schedule.catch((message) => {
                    $this.html(`<div class="alert alert-danger" role="alert">${message}</div>`);
                });
            };

            var intervalTime = settings.updateTime + ( Math.random() * settings.updateTimeRandom );
            var firstReqTime = 250 + ( Math.random() * settings.firstUpdateTimeRandom );

            addLoadingIndicator();
            setInterval(updateSchedule, intervalTime);
            setTimeout(updateSchedule, firstReqTime);

        });
        return this;
    };
})();