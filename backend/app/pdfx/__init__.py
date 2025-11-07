"""
PDF extraction and normalization.

This module contains the core scripts and workflows for pdf
data extraction and cli support

"""
import click

class PageRange(click.ParamType):
    name = "page-range"

    def convert(self, value, param, ctx):
        try:
            start, end = map(int, value.split("-"))
            return (start, end)
        except Exception:
            self.fail(f"{value} is not a valid page range. Use START-END format.", param, ctx)