import { array, object, string } from 'yup';
import { addDays, differenceInDays, isValid } from 'date-fns';
import { injectable } from 'inversify';

import type { PlaylistItem } from '#types/playlist';
import { getDataOrThrow } from '#src/utils/api';
import { logDev } from '#src/utils/common';
import type { EpgProgram, EpgChannel } from '#types/epg';

const AUTHENTICATION_HEADER = 'API-KEY';

export const isFulfilled = <T>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T> => {
  if (input.status === 'fulfilled') {
    return true;
  }

  logDev(`An error occurred resolving a promise: `, input.reason);
  return false;
};

const epgProgramSchema = object().shape({
  id: string().required(),
  title: string().required(),
  startTime: string()
    .required()
    .test((value) => (value ? isValid(new Date(value)) : false)),
  endTime: string()
    .required()
    .test((value) => (value ? isValid(new Date(value)) : false)),
  chapterPointCustomProperties: array().of(
    object().shape({
      key: string().required(),
      value: string().test('required-but-empty', 'value is required', (value: unknown) => typeof value === 'string'),
    }),
  ),
});

@injectable()
export default class EpgService {
  /**
   * Update the start and end time properties of the given programs with the current date.
   * This can be used when having a static schedule or while developing
   */
  private generateDemoPrograms(programs: EpgProgram[]) {
    const today = new Date();
    const startDate = new Date(programs[0]?.startTime);

    // this makes sure that the start of the day is correct. `startOfDay(startDate)` doesn't work since it can yield
    // a different date depending on the timezone.
    // for example, given a startTime of `2022-08-03T23:00:00Z` will parse to `2022-08-04T01:00:00+0200` in
    // Europe/Amsterdam (GMT+2) which makes startOfDay return `2022-08-04T00:00:00+0200`.
    const utcStartDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const daysDelta = differenceInDays(today, utcStartDate);

    return programs.map((program) => ({
      ...program,
      startTime: addDays(new Date(program.startTime), daysDelta).toJSON(),
      endTime: addDays(new Date(program.endTime), daysDelta).toJSON(),
    }));
  }

  /**
   * Validate the given data with the epgProgramSchema and transform it into an EpgProgram
   */
  transformProgram = async (data: unknown): Promise<EpgProgram> => {
    const program = await epgProgramSchema.validate(data);
    const image = program.chapterPointCustomProperties?.find((item) => item.key === 'image')?.value || undefined;

    return {
      id: program.id,
      title: program.title,
      startTime: program.startTime,
      endTime: program.endTime,
      cardImage: image,
      backgroundImage: image,
      description: program.chapterPointCustomProperties?.find((item) => item.key === 'description')?.value || undefined,
    };
  };

  /**
   * Ensure the given data validates to the EpgProgram schema
   */
  parseSchedule = async (data: unknown, demo = false) => {
    if (!Array.isArray(data)) return [];

    const transformResults = await Promise.allSettled(
      data.map((program) =>
        this.transformProgram(program)
          // This quiets promise resolution errors in the console
          .catch((error) => {
            logDev(error);
            return undefined;
          }),
      ),
    );

    const programs = transformResults
      .filter(isFulfilled)
      .map((result) => result.value)
      .filter((program): program is EpgProgram => !!program);

    return demo ? this.generateDemoPrograms(programs) : programs;
  };

  /**
   * Fetch the schedule data for the given PlaylistItem
   */
  fetchSchedule = async (item: PlaylistItem) => {
    if (!item.scheduleUrl) {
      logDev('Tried requesting a schedule for an item with missing `scheduleUrl`', item);
      return undefined;
    }

    const headers = new Headers();

    // add authentication token when `scheduleToken` is defined
    if (item.scheduleToken) {
      headers.set(AUTHENTICATION_HEADER, item.scheduleToken);
    }

    try {
      const response = await fetch(item.scheduleUrl, {
        headers,
      });

      // await needed to ensure the error is caught here
      return await getDataOrThrow(response);
    } catch (error: unknown) {
      if (error instanceof Error) {
        logDev(`Fetch failed for EPG schedule: '${item.scheduleUrl}'`, error);
      }
    }
  };

  /**
   * Fetch and parse the EPG schedule for the given PlaylistItem.
   * When there is no program (empty schedule) or the request fails, it returns a static program.
   */
  getSchedule = async (item: PlaylistItem) => {
    const schedule = await this.fetchSchedule(item);
    const programs = await this.parseSchedule(schedule, !!item.scheduleDemo);
    const catchupHours = item.catchupHours && parseInt(item.catchupHours);

    return {
      id: item.mediaid,
      title: item.title,
      description: item.description,
      catchupHours: catchupHours || 8,
      channelLogoImage: item.channelLogoImage,
      backgroundImage: item.backgroundImage,
      programs,
    } as EpgChannel;
  };

  /**
   * Get all schedules for the given PlaylistItem's
   */
  getSchedules = async (items: PlaylistItem[]) => {
    return Promise.all(items.map((item) => this.getSchedule(item)));
  };
}
