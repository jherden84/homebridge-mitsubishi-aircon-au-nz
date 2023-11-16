import {MelviewMitsubishiHomebridgePlatform} from "../platform";
import {CharacteristicValue, PlatformAccessory, Service, PlatformConfig} from "homebridge";
import {WorkMode} from "../data";
import {AbstractService} from "./abstractService";
import {
    CommandPower,
    CommandRotationSpeed,
    CommandTargetHeaterCoolerState,
    CommandTemperature
} from "../melviewCommand";
import {WithUUID} from "hap-nodejs";
import {ZoneAccessory} from "../platformAccessory";

export class HeatCoolService extends AbstractService {
  public readonly accessories: PlatformAccessory[] = [];
    constructor(
        protected readonly platform: MelviewMitsubishiHomebridgePlatform,
        protected readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);

        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onSet(this.setTargetHeaterCoolerState.bind(this))
            .onGet(this.getTargetHeaterCoolerState.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.minValue = -50;
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.maxValue = 70;
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).props.minStep = 0.5;

        this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .onSet(this.setCoolingThresholdTemperature.bind(this))
            .onGet(this.getCoolingThresholdTemperature.bind(this));;
        const cool = this.device.state!.max![WorkMode.COOL + ''];
        this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minValue = cool.min;
        this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.maxValue = cool.max;
        this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minStep = 0.5;

        this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onSet(this.setHeatingThresholdTemperature.bind(this))
            .onGet(this.getHeatingThresholdTemperature.bind(this));
        const heat = this.device.state!.max![WorkMode.HEAT + ''];
        this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minValue = heat.min;
        this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.maxValue = heat.max;
        this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minStep = 0.5;
    }

    protected getServiceType<T extends WithUUID<typeof Service>>() : T {
        return this.platform.Service.HeaterCooler as T;
    }

    protected getDeviceRoom(): string {
        return this.device.room;
    }

    protected getDeviceName() : string {
        return this.device.name!;
    }

    async getActive(): Promise<CharacteristicValue> {
        if (this.device.state?.setmode === WorkMode.DRY ||
        this.device.state?.setmode === WorkMode.FAN) {
            return this.platform.Characteristic.Active.INACTIVE;
        } else {
            return this.device.state!.power === 0?
                this.platform.Characteristic.Active.INACTIVE:
                this.platform.Characteristic.Active.ACTIVE;
        }
    }

    async setActive(value: CharacteristicValue) {
        await this.platform.melviewService?.command(
            new CommandPower(value, this.device, this.platform));
            //this.platform.log.error('power***', value);

            const b = this.accessory.context.device.state!;//.zones[1].zoneid;
            //this.platform.log.error('power***', b);

            //this is the test to check if Zones are present, if there are defined zones (more than 2) proceed to find accessory.
            if (b.zones.length || b.zones.length >=2)
            {
              this.platform.log.debug('Looking for zones to update:', b.zones.length, 'found. Proceeding to find accessories and updateCharacteristic');
            for (let k = 0; k < b.zones.length; k++)
            {
              const zone = b.zones[k];
                //const c = this.accessory.context.device.state!.zones![0].name;//.zones[1].zoneid;

            //this.platform.log.error('acc', this.platform.accessories); //all accessories on the platform. :)
            //const uuid = this.api.hap.uuid.generate(zone.name);
            //const uuid = 'dd2e0a14-6461-4570-bc80-589826942d30'
            const existingzoneaccessory = this.platform.accessories.find(zoneaccessory => zoneaccessory.displayName === zone.name);
            //this.platform.log.error('zones!!', existingzoneaccessory);
            //existingzoneaccessory.service.updateCharacteristic(this.platform.Characteristic.Active.INACTIVE);
            if (existingzoneaccessory){
                  let service = existingzoneaccessory.getService(this.platform.Service.Fanv2);
                if (service){
                      if (value === 0) { //ac power off override status as off (not setting just updating.)
                          service.updateCharacteristic(this.platform.Characteristic.Active, 0);
                          this.platform.log.debug('updateCharacteristic', zone.name, ': OFF (as AC is OFF)');
                          }
                          else // ac power on restore status
                          {
                            service.updateCharacteristic(this.platform.Characteristic.Active, zone.status);
                            this.platform.log.debug('updateCharacteristic', zone.name, (zone.status===1)?': ON':': OFF',  '(last found Zone state)');
                          }
                  }
                } else {this.platform.log.error('No exisitingzoneaccessory found...Zone (name/ID):', zone.name, zone.zoneid, zone.displayName);}
            }// zone end Loop
          }//end zones defined.
        }

    async setCoolingThresholdTemperature(value: CharacteristicValue) {
        this.platform.log.debug('setCoolingThresholdTemperature ->', value);
        const minVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.maxValue!;
        if (value! < minVal) {
            this.platform.log.warn('setCoolingThresholdTemperature ->', value, 'is illegal - updating to', minVal);
            value = minVal;
        } else if (value! > maxVal) {
            this.platform.log.warn('setCoolingThresholdTemperature ->', value, 'is illegal - updating to', maxVal);
            value = maxVal;
        }
        this.platform.melviewService?.command(
            new CommandTemperature(value, this.device, this.platform));
    }

    async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
        const temp = parseFloat(this.device.state!.settemp)
        const minVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.CoolingThresholdTemperature).props.maxValue!;
        if (temp < minVal) {
            return minVal;
        } else if (temp > maxVal) {
            return maxVal;
        }
        return temp;
    }

    async setHeatingThresholdTemperature(value: CharacteristicValue) {
        this.platform.log.debug('setHeatingThresholdTemperature:', value);
        const minVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.maxValue!;
        if (value! < minVal) {
            this.platform.log.warn('setHeatingThresholdTemperature ->', value, 'is illegal - updating to', minVal);
            value = minVal;
        } else if (value! > maxVal) {
            this.platform.log.warn('setHeatingThresholdTemperature ->', value, 'is illegal - updating to', maxVal);
            value = maxVal;
        }

        this.platform.melviewService?.command(
            new CommandTemperature(value, this.device, this.platform));
    }

    async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
        const temp = parseFloat(this.device.state!.settemp)
        const minVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.minValue!;
        const maxVal = this.service.getCharacteristic(this.characterisitc.HeatingThresholdTemperature).props.maxValue!;
        if (temp < minVal) {
            return minVal;
        } else if (temp > maxVal) {
            return maxVal;
        }
        return temp;
    }

    async getCurrentHeaterCoolerState(mode?:number): Promise<CharacteristicValue> {
        if (!mode) {
            mode = this.device.state!.setmode;
        }
        const c = this.platform.api.hap.Characteristic;
        const roomTemp = parseFloat(this.device.state!.roomtemp);
        const targTemp = parseFloat(this.device.state!.settemp);
        switch (mode) {
            case WorkMode.COOL:
                this.platform.log.debug('getCurrentHeaterCoolerState: COOLING');
                return c.CurrentHeaterCoolerState.COOLING;
            case WorkMode.DRY:
            case WorkMode.FAN:
                this.platform.log.debug('getCurrentHeaterCoolerState: IDLE');
                return c.CurrentHeaterCoolerState.IDLE;
            case WorkMode.HEAT:
                this.platform.log.debug('getCurrentHeaterCoolerState: HEATING');
                return c.CurrentHeaterCoolerState.HEATING;
            case WorkMode.AUTO:
                if (roomTemp < targTemp) {
                    this.platform.log
                        .debug('getCurrentHeaterCoolerState (AUTO): HEATING, Target:',
                            targTemp, ' Room:', roomTemp);
                    return c.CurrentHeaterCoolerState.HEATING;
                } else if (roomTemp > targTemp) {
                    this.platform.log
                        .debug('getCurrentHeaterCoolerState (AUTO): COOLING, Target:',
                            targTemp, ' Room:', roomTemp);
                    return c.CurrentHeaterCoolerState.COOLING;
                } else {
                    this.platform.log
                        .debug('getCurrentHeaterCoolerState (AUTO): IDLE, Target:',
                            targTemp, ' Room:', roomTemp);
                    return c.CurrentHeaterCoolerState.IDLE;
                }
        }
        this.platform.log
            .error('getCurrentHeaterCoolerState (UNKNOWN STATE)', mode);
        return c.CurrentHeaterCoolerState.INACTIVE;
    }

    async setTargetHeaterCoolerState(value: CharacteristicValue) {
        this.platform.log.debug('setTargetHeaterCoolerState ->', value);
        await this.platform.melviewService?.command(
            new CommandTargetHeaterCoolerState(value, this.device, this.platform));
        const c = this.platform.Characteristic;
        switch (value) {
            case c.TargetHeaterCoolerState.COOL:
                this.service.setCharacteristic(c.CurrentHeaterCoolerState, c.CurrentHeaterCoolerState.COOLING);
                return;
            case c.TargetHeaterCoolerState.HEAT:
                this.service.setCharacteristic(c.CurrentHeaterCoolerState, c.CurrentHeaterCoolerState.HEATING);
                return;
            case c.TargetHeaterCoolerState.AUTO:
                const state = await this.getCurrentHeaterCoolerState(WorkMode.AUTO);
                this.service.setCharacteristic(c.CurrentHeaterCoolerState, state);
        }
    }

    async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
        const mode = this.device.state!.setmode;
        const c = this.platform.api.hap.Characteristic;
        switch (mode) {
            case WorkMode.HEAT:
                this.platform.log.debug('getTargetHeaterCoolerState -> HEAT');
                return c.TargetHeaterCoolerState.HEAT;
            case WorkMode.COOL: /*case WorkMode.FAN: case WorkMode.DRY:*/
                this.platform.log.debug('getTargetHeaterCoolerState -> COOL');
                return c.TargetHeaterCoolerState.COOL;
            case WorkMode.AUTO:
                this.platform.log.debug('getTargetHeaterCoolerState -> AUTO');
                return c.TargetHeaterCoolerState.AUTO;
        }
        this.platform.log.debug('getTargetHeaterCoolerState -> AUTO');
        return c.TargetHeaterCoolerState.AUTO;
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return parseFloat(this.device.state!.roomtemp);
    }

    async setRotationSpeed(value: CharacteristicValue) {
        this.platform.log.debug('RotationSpeed ->', value);
        this.platform.melviewService?.command(
            new CommandRotationSpeed(value, this.device, this.platform));
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        const fan = this.device.state!.setfan;
        switch (fan) {
            case 1:
                return 20;
            case 2:
                return 40;
            case 3:
                return 60;
            case 5:
                return 80;
            case 6:
                return 100;
            default:
                return 20;
        }
    }
}
