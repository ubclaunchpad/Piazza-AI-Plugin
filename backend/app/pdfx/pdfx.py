"""

command line interface for pdf extraction.

"""
import click
from pathlib import Path
from .extraction import pdf_extract, sha256_file
from . import PageRange




@click.group()
@click.version_option(version="0.1.0")
def cli():
    """pdfx core cli"""
    pass

@cli.command()
def health_check():
    """health check command """
    click.echo("pdfx cli active and healthy!")

@cli.command()
@click.argument("input_path", type=click.Path(exists=True, dir_okay=False, readable=True))
@click.option("--out", "-o", "output_path",
              type=click.Path(dir_okay=True, writable=True),
              default="./",
              help="relative output file path")
@click.option("--page-range", "-p", "page_range", help="Range of text extraction", type = PageRange())
def extract(input_path, output_path, page_range):
    """
    Extract Pdf to JSONL.

    Arguments:
        input_path: input file path

    Options:
        out: output file path or directory path
          - default, if no output file is given, auto generate .jsonl
          - if out is a directory, also generate .jsonl
        page_range

    Exit Codes:
        0: Success
        1: Partial (some files read)
        2: Fatal

    """

    # Check if page range was given
    if page_range:
        start, end = page_range
        click.echo(f"Extracting pages {start} to {end}")
    else:
        start, end = None,None
        

    input_path = Path(input_path)
    output_path = Path(output_path)

    if output_path.is_dir():
        output_path = output_path / f"{input_path.stem}-{sha256_file(input_path)}.jsonl"

    click.echo(f"extracting from {input_path} to {output_path}")
    # pass None to pdf_extract when no page range was provided
    page_range_arg = None if (start is None and end is None) else (start, end)
    exit_code = pdf_extract(input_path, output_path, page_range_arg)
    raise SystemExit(exit_code)
    

if __name__ == '__main__':
    cli()