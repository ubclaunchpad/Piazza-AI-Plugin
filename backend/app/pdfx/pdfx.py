"""

command line interface for pdf extraction.

"""
import click
import extraction
from pathlib import Path


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
def extract(input_path, output_path):
    """
    Extract Pdf to JSONL.

    Args:
        input_path: input file path
        out: output file path or directory path
          - default, if no output file is given, auto generate .jsonl
          - if out is a directory, also generate .jsonl

    Exit Codes:
        0: Success
        1: Partial (some files read)
        2: Fatal

    """
    doc_id:str = extraction.sha256_file(input_path)

    input_path = Path(input_path)
    output_path = Path(output_path)

    if output_path.is_dir():
        output_path = output_path / f"{input_path.stem}-{doc_id}.jsonl"

    click.echo(f"extracting from {input_path} to {output_path}")
    exit_code = extraction.pdf_extract(input_path, output_path)
    raise SystemExit(exit_code)
    

if __name__ == '__main__':
    cli()