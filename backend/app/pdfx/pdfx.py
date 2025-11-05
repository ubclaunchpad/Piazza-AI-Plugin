"""

command line interface for pdf extraction.

"""
import click
import extraction


@click.group()
def cli():
    """pdfx core cli"""
    pass

@cli.command()
def health_check():
    """health check command """
    click.echo("pdfx cli active and healthy!")

@cli.command()
@click.argument("input_path", type=click.Path(exists=True, dir_okay=False, readable=True))
@click.option("--out", "-o",
              type=click.Path(dir_okay=True, writable=True),
              default="./",
              help="relative output file path")
def extract(input_path, out):
    """
    Extract Pdf to JSONL.

    Args:
        input_path: input file path
        out: output directory or file (write)

    Exit Codes:
        0: Success
        1: Partial (some files read)
        2: Fatal

    """
    
    click.echo(f"extracting from {input_path} to {out}")
    sha:str = extraction.sha256_file(input_path)
    click.echo(f"unique file identifier {sha}")
    

if __name__ == '__main__':
    cli()