import sys
from awsglue.transforms import *
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from pyspark.sql.functions import from_unixtime
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(sys.argv, ["JOB_NAME", "DEST_BUCKET", "DATABASE", "TABLE", "YEAR", "MONTH", "DATE"])
year = args["YEAR"]
month = args["MONTH"]
day = args["DATE"]

glueContext = GlueContext(SparkContext.getOrCreate())

df1 = glueContext.create_data_frame.from_catalog(
    database=args["DATABASE"], table_name=args["TABLE"], transformation_ctx="cdrs"
)

df1.show(10)

df2 = (
    df1.withColumn("duration", df1.EndTimeEpochSeconds - df1.StartTimeEpochSeconds)
    .withColumn("npanxx", df1.DestinationPhoneNumber[3:6])
    .withColumnRenamed("partition_2", "year")
    .withColumnRenamed("partition_3", "month")
    .withColumnRenamed("partition_4", "day")
    .withColumn("hour", from_unixtime(df1.StartTimeEpochSeconds, "HH"))
)

df3 = df2.repartition(1)

df3.write.mode("append").parquet(
    "s3://" + args["DEST_BUCKET"] + "/processed_cdrs/", partitionBy=["voiceconnectorid", "year", "month", "day", "hour"]
)
