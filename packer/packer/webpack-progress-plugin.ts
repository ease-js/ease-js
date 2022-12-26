import ansiEscapes from 'ansi-escapes';
import chalk from 'chalk';
import cliTruncate from 'cli-truncate';
import signale from 'lazy-signale';
import prettyTime from 'pretty-time';
import webpack from 'webpack';

export class ProgressPlugin extends webpack.ProgressPlugin {
  public static registry = new Set<ProgressPlugin>();

  public static ttyOutput = '';

  public readonly name: string = 'ProgressPlugin';

  readonly #signal = new signale.Signale({ scope: 'easepack' });

  #failed: boolean = false;

  #message = '';

  #percentage = 0;

  #percentageNoTTY = 0;

  #startTime?: [number, number];

  public constructor() {
    super({
      activeModules: false,
      dependencies: true,
      dependenciesCount: 10000,
      entries: true,
      modules: true,
      modulesCount: 5000,
      percentBy: null,
      profile: false,
      handler: (progress, message) => this.#update(progress * 100, message),
    });
  }

  public apply(compiler: webpack.Compiler): void {
    super.apply(compiler);

    compiler.hooks.compile.tap(this.name, () => {
      this.#startTime = process.hrtime();
      ProgressPlugin.registry.add(this);
    });

    compiler.hooks.done.tap(this.name, stat => {
      this.#failed = stat.hasErrors();
      this.#render();
      ProgressPlugin.registry.delete(this);
    });
  }

  #render(): void {
    if (process.stdout.isTTY) {
      const lines: string[] = [];
      const { columns = 70 } = process.stdout;

      for (const that of ProgressPlugin.registry) {
        const parts: string[] = [];

        if (that.#percentage === 100) {
          const costTime = that.#startTime ? renderCostTime(that.#startTime) : null;

          parts.push(that.#failed ? chalk.red('✖ failed') : chalk.green('✔ done'));
          if (costTime) parts.push(`in ${costTime}`);
        } else {
          const msg = chalk.gray(cliTruncate(that.#message, 25, { position: 'start' }));
          const left = Math.trunc((that.#percentage * 25) / 100);
          const right = 25 - left;
          const bar = `${chalk.green('█'.repeat(left))}${chalk.gray('█'.repeat(right))}`;
          const percentage = `${that.#percentage.toFixed(1).padStart(3)}%`;
          const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

          parts.push(chalk.green('◯'));
          if (columns >= 70) parts.push(bar, percentage, msg);
          else if (columns >= 40) parts.push(bar, percentage);
          else if (columns >= 15) parts.push(bar);
          else parts.push(frames[that.#percentage % frames.length]);
        }

        lines.push(parts.join(' '));
      }

      const previousTTYOutput = ProgressPlugin.ttyOutput;
      ProgressPlugin.ttyOutput = lines
        .map(output => cliTruncate(output, columns, { position: 'end' }))
        .join('\n');

      if (ProgressPlugin.ttyOutput !== previousTTYOutput) {
        const previousLineCount = previousTTYOutput.split('\n').length;
        process.stdout.write(ansiEscapes.eraseLines(previousLineCount) + ProgressPlugin.ttyOutput);
      }
    } else {
      for (const that of ProgressPlugin.registry) {
        if (that.#percentage === 100) {
          const costTime = that.#startTime ? renderCostTime(that.#startTime) : '?';
          if (that.#failed) that.#signal.error(`compile failed in ${costTime}`);
          else that.#signal.success(`compile done in ${costTime}`);
        } else if (that.#percentage - that.#percentageNoTTY > 10) {
          that.#percentageNoTTY = that.#percentage;
          that.#signal.info(`compile progress: ${that.#percentageNoTTY.toFixed(0)}%`);
        }
      }
    }
  }

  #update(percentage: number, message: string): void {
    this.#message = message;

    if (percentage <= 0) {
      this.#percentage = 0;
    } else if (percentage >= 100) {
      this.#percentage = 100;
    } else if (percentage > this.#percentage) {
      this.#percentage = percentage;
    } else if (this.#percentage < 99) {
      this.#percentage +=
        this.#percentage < 30 ? 0.1 : 60 < this.#percentage && this.#percentage < 80 ? 0.4 : 0.2;
    }

    this.#render();
  }
}

function renderCostTime(startTime: [number, number]): string {
  return prettyTime(process.hrtime(startTime), undefined, 2);
}
